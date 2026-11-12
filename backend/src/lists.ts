import { z } from 'zod'
import { prisma } from './db.js'
import { cost, syncPurchase } from './purchases.js'

// The only module that reads or writes List and Item rows. Every function is scoped by userId
// and throws P2025 (mapped to 404) when the list or item isn't the user's.
// Inputs are already validated: the routes parse request bodies with the schemas below.

export const Name = z.string().trim().min(1).max(100)
const Quantity = z.number().int().min(1).max(999)
const Price = z.number().int().min(0).max(10_000_000).nullable() // euro cents per unit; null = unknown
export const ListBody = z.object({ name: Name })
export const NewItem = z.object({ name: Name, quantity: Quantity.default(1), priceCents: Price.default(null) })
export const ItemPatch = z.object({
  name: Name.optional(),
  quantity: Quantity.optional(),
  priceCents: Price.optional(),
  checked: z.boolean().optional(),
})
export type NewItem = z.infer<typeof NewItem>
export type ItemPatch = z.infer<typeof ItemPatch>

const ownedList = (userId: string, id: string) =>
  prisma.list.findFirstOrThrow({ where: { id, userId }, select: { id: true, name: true } })

// Newest first. Active: at least one item still to buy, or no items yet.
export async function listSummaries(userId: string, { activeOnly = false } = {}) {
  const lists = await prisma.list.findMany({
    where: {
      userId,
      ...(activeOnly && { OR: [{ items: { some: { checkedAt: null } } }, { items: { none: {} } }] }),
    },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { priceCents: true, quantity: true, checkedAt: true } } },
  })
  return lists.map(({ items, ...list }) => {
    const toBuy = items.filter((i) => i.checkedAt === null)
    return {
      id: list.id,
      name: list.name,
      createdAt: list.createdAt,
      remaining: toBuy.length,
      total: items.length,
      estimatedCents: toBuy.reduce((sum, i) => sum + cost(i), 0),
    }
  })
}

export const getList = (userId: string, id: string) =>
  prisma.list.findFirstOrThrow({
    where: { id, userId },
    include: {
      items: { orderBy: [{ checkedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }] },
    },
  })

export const createList = (userId: string, name: string) => prisma.list.create({ data: { name, userId } })

export const renameList = (userId: string, id: string, name: string) =>
  prisma.list.update({ where: { id, userId }, data: { name } })

// Items cascade; their Purchase rows stay as history (itemId set to null).
export async function deleteList(userId: string, id: string) {
  await prisma.list.delete({ where: { id, userId } })
}

// Every item write runs in one transaction and ends with syncPurchase,
// so the item's Purchase row always matches the item.

export async function addItem(userId: string, listId: string, data: NewItem) {
  const list = await ownedList(userId, listId)
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.create({ data: { ...data, listId: list.id } })
    await syncPurchase(tx, userId, item, list.name)
    return item
  })
}

export async function updateItem(userId: string, listId: string, itemId: string, patch: ItemPatch) {
  const list = await ownedList(userId, listId)
  const where = { id: itemId, listId: list.id }

  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUniqueOrThrow({ where })
    const { checked } = patch
    // Checking an already-checked item keeps its original time.
    const checkedAt = checked === undefined ? item.checkedAt : checked ? (item.checkedAt ?? new Date()) : null
    const updated = await tx.item.update({
      where,
      data: {
        name: patch.name ?? item.name,
        quantity: patch.quantity ?? item.quantity,
        // undefined = leave as is; null clears the price
        priceCents: patch.priceCents === undefined ? item.priceCents : patch.priceCents,
        checkedAt,
      },
    })
    await syncPurchase(tx, userId, updated, list.name)
    return updated
  })
}

// No syncPurchase needed: the Purchase row stays as history, with itemId set to null.
export async function removeItem(userId: string, listId: string, itemId: string) {
  const list = await ownedList(userId, listId)
  await prisma.item.delete({ where: { id: itemId, listId: list.id } })
}
