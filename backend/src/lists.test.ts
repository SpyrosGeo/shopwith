import { expect, test } from 'vitest'
import { prisma } from './db.js'
import { testUser } from './test-helpers.js'
import {
  addItem,
  addToNewestActiveList,
  createList,
  deleteList,
  getList,
  listSummaries,
  removeItem,
  renameList,
  updateItem,
} from './lists.js'

const purchases = (userId: string) => prisma.purchase.findMany({ where: { userId } })

test("every item write keeps the item's purchase in step", async () => {
  const { id: userId } = await testUser()
  const list = await createList(userId, 'Weekly')
  const item = await addItem(userId, list.id, { name: 'Milk', quantity: 1, priceCents: 100 })
  expect(await purchases(userId)).toEqual([]) // unchecked: no purchase

  const checked = await updateItem(userId, list.id, item.id, { checked: true })
  expect(await purchases(userId)).toMatchObject([
    { itemId: item.id, name: 'milk', displayName: 'Milk', quantity: 1, priceCents: 100, listName: 'Weekly' },
  ])

  await updateItem(userId, list.id, item.id, { name: 'Oat Milk ', quantity: 2, priceCents: 150 })
  expect(await purchases(userId)).toMatchObject([
    { itemId: item.id, name: 'oat milk', displayName: 'Oat Milk', quantity: 2, priceCents: 150, listName: 'Weekly' },
  ]) // the edit alone syncs the row

  const rechecked = await updateItem(userId, list.id, item.id, { checked: true })
  expect(rechecked.checkedAt).toEqual(checked.checkedAt) // re-check keeps the original time
  const [row] = await purchases(userId)
  expect(row!.purchasedAt).toEqual(checked.checkedAt)

  await updateItem(userId, list.id, item.id, { checked: false })
  expect(await purchases(userId)).toEqual([]) // unchecking undoes the purchase

  await updateItem(userId, list.id, item.id, { checked: true })
  await removeItem(userId, list.id, item.id)
  expect(await purchases(userId)).toMatchObject([{ itemId: null, name: 'oat milk' }]) // outlives its item
})

test('price patch: undefined leaves it, null clears it', async () => {
  const { id: userId } = await testUser()
  const list = await createList(userId, 'L')
  const item = await addItem(userId, list.id, { name: 'Milk', quantity: 1, priceCents: 149 })

  expect(await updateItem(userId, list.id, item.id, { quantity: 2 })).toMatchObject({ priceCents: 149 })
  expect(await updateItem(userId, list.id, item.id, { priceCents: null })).toMatchObject({ priceCents: null })
})

test('summaries: counts, estimate, and active = items left to buy or empty', async () => {
  const { id: userId } = await testUser()
  const done = await createList(userId, 'Done')
  const doneItem = await addItem(userId, done.id, { name: 'Milk', quantity: 1, priceCents: null })
  await updateItem(userId, done.id, doneItem.id, { checked: true })

  const partial = await createList(userId, 'Partial')
  const bought = await addItem(userId, partial.id, { name: 'Bread', quantity: 1, priceCents: 300 })
  await addItem(userId, partial.id, { name: 'Eggs', quantity: 2, priceCents: 250 })
  await addItem(userId, partial.id, { name: 'Salt', quantity: 1, priceCents: null })
  await updateItem(userId, partial.id, bought.id, { checked: true })

  const empty = await createList(userId, 'Empty')

  const emptySummary = { id: empty.id, name: 'Empty', remaining: 0, total: 0, estimatedCents: 0 }
  const partialSummary = { id: partial.id, name: 'Partial', remaining: 2, total: 3, estimatedCents: 500 }
  expect(await listSummaries(userId, { activeOnly: true })).toMatchObject([emptySummary, partialSummary])
  expect(await listSummaries(userId)).toMatchObject([
    emptySummary,
    partialSummary,
    { id: done.id, remaining: 0, total: 1 },
  ])
})

test('addToNewestActiveList: newest active list, else a new "Shopping" list', async () => {
  const { id: userId } = await testUser()
  const milk = { name: 'Milk', quantity: 1, priceCents: 129 }

  const first = await addToNewestActiveList(userId, milk)
  expect(first.list.name).toBe('Shopping') // no lists yet
  expect(first.item).toMatchObject({ ...milk, listId: first.list.id, checkedAt: null })

  const older = await createList(userId, 'Older')
  const newer = await createList(userId, 'Newer')
  expect((await addToNewestActiveList(userId, milk)).list.id).toBe(newer.id) // newest active wins

  const items = await prisma.item.findMany({ where: { list: { userId }, checkedAt: null } })
  for (const item of items) await updateItem(userId, item.listId, item.id, { checked: true })
  await addItem(userId, older.id, milk)
  expect((await addToNewestActiveList(userId, milk)).list.id).toBe(older.id) // fully checked lists are skipped

  await prisma.item.updateMany({ where: { list: { userId } }, data: { checkedAt: new Date() } })
  const created = await addToNewestActiveList(userId, milk)
  expect(created.list).toMatchObject({ name: 'Shopping' }) // none active: creates another
  expect(created.list.id).not.toBe(first.list.id)
})

test("every function refuses another user's list", async () => {
  const { id: alice } = await testUser()
  const { id: bob } = await testUser()
  const list = await createList(alice, 'Private')
  const item = await addItem(alice, list.id, { name: 'Eggs', quantity: 1, priceCents: null })
  const notFound = { code: 'P2025' }

  expect(await listSummaries(bob)).toEqual([])
  await expect(getList(bob, list.id)).rejects.toMatchObject(notFound)
  await expect(renameList(bob, list.id, 'Hacked')).rejects.toMatchObject(notFound)
  await expect(addItem(bob, list.id, { name: 'X', quantity: 1, priceCents: null })).rejects.toMatchObject(notFound)
  await expect(updateItem(bob, list.id, item.id, { checked: true })).rejects.toMatchObject(notFound)
  await expect(removeItem(bob, list.id, item.id)).rejects.toMatchObject(notFound)
  await expect(deleteList(bob, list.id)).rejects.toMatchObject(notFound)

  expect(await getList(alice, list.id)).toMatchObject({ name: 'Private', items: [{ name: 'Eggs', checkedAt: null }] })
  expect(await purchases(alice)).toEqual([])
})
