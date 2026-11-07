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
