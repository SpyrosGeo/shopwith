import { expect, test } from 'vitest'
import { prisma } from './db.js'
import { testUser } from './test-helpers.js'
import { monthlySpend, productKey, products } from './purchases.js'

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
})
