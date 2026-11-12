import type { Prisma } from './generated/prisma/client.js'
import { prisma } from './db.js'

// The Purchase history module: the only writer of Purchase rows, and every reader of them
// (products, monthly spend; later suggestions and insights).

// The key every product feature groups by (spend, suggestions, autocomplete, categories),
// so "Milk " and "milk" are the same product.
export const productKey = (name: string) => name.trim().toLowerCase()

// Line cost in euro cents; an unknown price counts as 0.
export const cost = (item: { priceCents: number | null; quantity: number }) => (item.priceCents ?? 0) * item.quantity

type ItemState = {
  id: string
  name: string
  quantity: number
  priceCents: number | null
  checkedAt: Date | null
}

// The only writer of Purchase rows. Called only by lists.ts, after every item write, in the same transaction,
// with the item as it now is. It makes the item's Purchase match the item:
// - checked: exactly one row, carrying the item's current name, quantity and price
//   (listName and purchasedAt stay as they were when it was first checked)
// - unchecked: no row (undoes an accidental tap)
// Deleting the item needs no call: the row stays as history, with itemId set to null.
export async function syncPurchase(tx: Prisma.TransactionClient, userId: string, item: ItemState, listName: string) {
  if (!item.checkedAt) {
    await tx.purchase.deleteMany({ where: { itemId: item.id } })
    return
  }
  const current = {
    name: productKey(item.name),
    displayName: item.name.trim(),
    quantity: item.quantity,
    priceCents: item.priceCents,
  }
  await tx.purchase.upsert({
    where: { itemId: item.id },
    create: { ...current, userId, itemId: item.id, listName, purchasedAt: item.checkedAt },
    update: current,
  })
}

const PRODUCT_LIMIT = 500

export type Product = { name: string; lastPriceCents: number | null }

// Everything the user has bought, most-bought first, for autocomplete and price pre-fill.
// Small per user, so the client fetches it once and filters locally.
// shortcut: loads every purchase per call; add a grouped SQL query if histories get large.
export async function products(userId: string): Promise<Product[]> {
  const purchases = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { purchasedAt: 'desc' },
    select: { name: true, displayName: true, priceCents: true },
  })

  // Newest first, so the first row per name has the latest casing.
  const byName = new Map<string, Product & { count: number }>()
  for (const p of purchases) {
    const product = byName.get(p.name)
    if (!product) {
      byName.set(p.name, { name: p.displayName || p.name, lastPriceCents: p.priceCents, count: 1 })
      continue
    }
    product.count++
    product.lastPriceCents ??= p.priceCents // latest known price; skips unpriced purchases
  }

  return [...byName.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, PRODUCT_LIMIT)
    .map(({ name, lastPriceCents }) => ({ name, lastPriceCents }))
}

const MONTHS = 6

// Months are UTC calendar months, keyed 'YYYY-MM'.
const monthKey = (date: Date) => date.toISOString().slice(0, 7)

// Spend for the last six months ending with now's month, oldest first, zero-filled.
// Reads Purchase, not Item, so spend survives deleting the item or its list.
export async function monthlySpend(userId: string, now = new Date()) {
  const keys = Array.from({ length: MONTHS }, (_, i) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - i), 1))),
  )
  const since = new Date(`${keys[0]}-01T00:00:00Z`)

  const bought = await prisma.purchase.findMany({
    where: { userId, purchasedAt: { gte: since } },
    select: { priceCents: true, quantity: true, purchasedAt: true },
  })

  const months = new Map(keys.map((month) => [month, { month, totalCents: 0, itemCount: 0, unpricedCount: 0 }]))
  for (const purchase of bought) {
    const m = months.get(monthKey(purchase.purchasedAt))
    if (!m) continue
    m.totalCents += cost(purchase)
    m.itemCount++
    if (purchase.priceCents === null) m.unpricedCount++
  }
  return [...months.values()]
}

export type Suggestion = { name: string; medianIntervalMs: number; lastPriceCents: number | null }

// Due Products, most overdue first (see GLOSSARY.md "Due"): at least 3 Purchase days, time since the last
// one ≥ the median gap between them, not on any list as an unchecked item, and not snoozed.
export async function due(userId: string, now = new Date()): Promise<Suggestion[]> {
  const bought = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { purchasedAt: 'asc' },
    select: { name: true, displayName: true, priceCents: true, purchasedAt: true },
  })
  const onList = new Set(
    (await prisma.item.findMany({ where: { list: { userId }, checkedAt: null }, select: { name: true } })).map((i) =>
      productKey(i.name),
    ),
  )
  const snoozed = new Set(
    (await prisma.userProduct.findMany({ where: { userId, snoozedUntil: { gt: now } }, select: { name: true } })).map(
      (p) => p.name,
    ),
  )

  // Oldest first, so the last write per name is the latest casing and price.
  const byName = new Map<
    string,
    { displayName: string; lastPriceCents: number | null; lastAt: number; days: Map<string, number> }
  >()
  for (const p of bought) {
    const product = byName.get(p.name) ?? { displayName: '', lastPriceCents: null, lastAt: 0, days: new Map() }
    product.displayName = p.displayName || p.name
    product.lastPriceCents = p.priceCents ?? product.lastPriceCents // skips unpriced purchases
    product.lastAt = p.purchasedAt.getTime() // the actual last Purchase, not the start of its day
    const day = p.purchasedAt.toISOString().slice(0, 10) // same UTC day = one Purchase day
    if (!product.days.has(day)) product.days.set(day, p.purchasedAt.getTime())
    byName.set(p.name, product)
  }

  return [...byName]
    .filter(([name, p]) => p.days.size >= 3 && !onList.has(name) && !snoozed.has(name))
    .map(([, p]) => {
      const times = [...p.days.values()]
      const gaps = times.slice(1).map((t, i) => t - times[i]!).sort((a, b) => a - b)
      const mid = gaps.length >> 1
      const median = gaps.length % 2 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2
      const overdue = (now.getTime() - p.lastAt) / median
      return { name: p.displayName, medianIntervalMs: median, lastPriceCents: p.lastPriceCents, overdue }
    })
    .filter((p) => p.overdue >= 1)
    .sort((a, b) => b.overdue - a.overdue)
    .map(({ overdue, ...suggestion }) => suggestion)
}

// Hides a due Product until now + its median interval (see GLOSSARY.md "Snooze").
// Returns false when the Product isn't due, since only due Products have a median to snooze by.
// shortcut: computes every due Product to snooze one; look up just this one if history grows large.
export async function snooze(userId: string, name: string, now = new Date()): Promise<boolean> {
  const key = productKey(name)
  const product = (await due(userId, now)).find((s) => productKey(s.name) === key)
  if (!product) return false
  const snoozedUntil = new Date(now.getTime() + product.medianIntervalMs)
  await prisma.userProduct.upsert({
    where: { userId_name: { userId, name: key } },
    create: { userId, name: key, snoozedUntil },
    update: { snoozedUntil },
  })
  return true
}
