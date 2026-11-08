import { expect, test } from 'vitest'
import { prisma } from './db.js'
import { testUser } from './test-helpers.js'
import { due, monthlySpend, productKey, products } from './purchases.js'

// Seeds a Purchase row directly, at a chosen time.
const bought = (userId: string, name: string, purchasedAt: string, rest: { quantity?: number; priceCents?: number } = {}) =>
  prisma.purchase.create({
    data: { userId, name: productKey(name), displayName: name.trim(), purchasedAt: new Date(purchasedAt), ...rest },
  })

const now = new Date('2026-03-10T12:00:00Z')

test('six zero-filled UTC months, oldest first, ending with now', async () => {
  const { id } = await testUser()
  const months = await monthlySpend(id, now)
  expect(months.map((m) => m.month)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'])
  expect(months.at(-1)).toEqual({ month: '2026-03', totalCents: 0, itemCount: 0, unpricedCount: 0 })
})

test('spend is price × quantity, by month bought', async () => {
  const { id } = await testUser()
  await bought(id, 'Milk', '2026-03-01T00:00:00Z', { quantity: 2, priceCents: 150 })
  await bought(id, 'Salt', '2026-03-09T00:00:00Z')
  await bought(id, 'Bread', '2026-01-31T23:59:59Z', { priceCents: 300 })
  await bought(id, 'Old', '2025-09-30T23:59:59Z', { priceCents: 999 }) // before the window

  const months = await monthlySpend(id, now)
  expect(months.at(-1)).toEqual({ month: '2026-03', totalCents: 300, itemCount: 2, unpricedCount: 1 })
  expect(months.at(-3)).toEqual({ month: '2026-01', totalCents: 300, itemCount: 1, unpricedCount: 0 })
  expect(months[0]).toMatchObject({ month: '2025-10', totalCents: 0 })
})

test('products: most-bought first, latest casing, latest known price', async () => {
  const { id } = await testUser()
  await bought(id, 'Bread', '2026-01-01T00:00:00Z', { priceCents: 280 })
  await bought(id, 'Bread', '2026-01-02T00:00:00Z', { priceCents: 300 })
  await bought(id, 'milk', '2026-01-03T00:00:00Z', { priceCents: 100 })
  await bought(id, 'Milk', '2026-01-04T00:00:00Z', { priceCents: 120 })
  await bought(id, 'Oat Milk ', '2026-01-05T00:00:00Z') // never priced
  await bought(id, 'MILK', '2026-01-06T00:00:00Z') // newest but unpriced: last known price stays 120

  expect(await products(id)).toEqual([
    { name: 'MILK', lastPriceCents: 120 },
    { name: 'Bread', lastPriceCents: 300 },
    { name: 'Oat Milk', lastPriceCents: null },
  ])
})

test("readers only see the user's own purchases", async () => {
  const { id: alice } = await testUser()
  const { id: bob } = await testUser()
  await bought(alice, 'Milk', '2026-03-01T00:00:00Z', { priceCents: 100 })

  expect(await products(bob)).toEqual([])
  expect((await monthlySpend(bob, now)).at(-1)!.totalCents).toBe(0)
  expect(await due(bob, now)).toEqual([])
})

const DAY = 24 * 60 * 60 * 1000
// `now` (2026-03-10T12:00Z) minus whole days, as an ISO string for bought().
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY).toISOString()

test('due: at least 3 Purchase days and time since last >= median interval', async () => {
  const { id } = await testUser()
  for (const d of [7, 5, 3]) await bought(id, 'Milk', daysAgo(d), { priceCents: 129 }) // gaps 2d, last 3d ago
  for (const d of [5, 3, 1]) await bought(id, 'Bread', daysAgo(d)) // gaps 2d, last 1d ago: not yet
  for (const d of [9, 2]) await bought(id, 'Salt', daysAgo(d)) // only 2 Purchase days

  expect(await due(id, now)).toEqual([{ name: 'Milk', medianIntervalMs: 2 * DAY, lastPriceCents: 129 }])
})

test('due: purchases on the same UTC day count as one Purchase day', async () => {
  const { id } = await testUser()
  await bought(id, 'Milk', '2026-03-01T08:00:00Z')
  await bought(id, 'Milk', '2026-03-01T20:00:00Z')
  await bought(id, 'Milk', '2026-03-03T08:00:00Z')

  expect(await due(id, now)).toEqual([])
})

test('due: time since last counts from the last Purchase, not the start of its day', async () => {
  const { id } = await testUser()
  await bought(id, 'Milk', '2026-03-01T08:00:00Z')
  await bought(id, 'Milk', '2026-03-03T08:00:00Z')
  await bought(id, 'Milk', '2026-03-05T08:00:00Z')
  await bought(id, 'Milk', '2026-03-05T20:00:00Z') // median 48h; last Purchase 03-05 20:00

  expect(await due(id, new Date('2026-03-07T10:00:00Z'))).toEqual([]) // 38h since last
  expect(await due(id, new Date('2026-03-07T20:00:00Z'))).toEqual([
    { name: 'Milk', medianIntervalMs: 2 * DAY, lastPriceCents: null },
  ])
})

test('due: most overdue first, latest casing and known price', async () => {
  const { id } = await testUser()
  for (const d of [6, 4, 2]) await bought(id, 'Eggs', daysAgo(d)) // 2d / 2d = 1
  for (const d of [5, 4, 3]) await bought(id, 'coffee', daysAgo(d), { priceCents: 899 })
  await bought(id, 'Coffee', daysAgo(2)) // unpriced; gaps 1d, 1d, 1d; last 2d ago: 2

  expect(await due(id, now)).toEqual([
    { name: 'Coffee', medianIntervalMs: DAY, lastPriceCents: 899 },
    { name: 'Eggs', medianIntervalMs: 2 * DAY, lastPriceCents: null },
  ])
})

test('due: even number of gaps uses the average of the middle two', async () => {
  const { id } = await testUser()
  for (const d of [20, 15, 12, 11, 10]) await bought(id, 'Rice', daysAgo(d)) // gaps 5,3,1,1 -> median 2d

  expect(await due(id, now)).toEqual([{ name: 'Rice', medianIntervalMs: 2 * DAY, lastPriceCents: null }])
})

test('due: excludes products on a list as an unchecked item', async () => {
  const { id } = await testUser()
  for (const d of [7, 5, 3]) await bought(id, 'Milk', daysAgo(d))
  for (const d of [7, 5, 3]) await bought(id, 'Eggs', daysAgo(d))
  await prisma.list.create({
    data: {
      userId: id,
      name: 'Weekly',
      items: { create: [{ name: ' MILK ' }, { name: 'Eggs', checkedAt: now }] }, // checked Eggs don't count
    },
  })

  expect((await due(id, now)).map((s) => s.name)).toEqual(['Eggs'])
})
