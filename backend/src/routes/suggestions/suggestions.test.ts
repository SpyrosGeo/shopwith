import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../../app.js'
import { prisma } from '../../db.js'
import { productKey } from '../../purchases.js'
import { loginUser } from '../../test-helpers.js'

const app = buildApp()
afterAll(() => app.close())

const DAY = 24 * 60 * 60 * 1000

// A user with Milk due: bought 7, 5 and 3 days ago (median 2d), last at €1.29.
async function userWithMilkDue() {
  const user = await loginUser(app)
  const now = Date.now() // one clock read, so the gaps are exactly 2d
  for (const d of [7, 5, 3]) {
    await prisma.purchase.create({
      data: {
        userId: user.id,
        name: productKey('Milk'),
        displayName: 'Milk',
        priceCents: 129,
        purchasedAt: new Date(now - d * DAY),
      },
    })
  }
  return user
}

test('requires login', async () => {
  expect((await app.inject({ method: 'GET', url: '/api/suggestions' })).statusCode).toBe(401)
  expect(
    (await app.inject({ method: 'POST', url: '/api/suggestions/snooze', payload: { name: 'Milk' } })).statusCode,
  ).toBe(401)
})

// Due rules are covered in src/purchases.test.ts.
test('lists due products', async () => {
  const { call } = await userWithMilkDue()
  expect((await call('GET', '/api/suggestions')).json()).toEqual([
    { name: 'Milk', medianIntervalMs: 2 * DAY, lastPriceCents: 129 },
  ])
})

test('a snoozed product disappears', async () => {
  const { call } = await userWithMilkDue()
  expect((await call('POST', '/api/suggestions/snooze', { name: 'Milk' })).statusCode).toBe(204)
  expect((await call('GET', '/api/suggestions')).json()).toEqual([])
})

test('snoozing a product that is not due is a 404', async () => {
  const { call } = await userWithMilkDue()
  expect((await call('POST', '/api/suggestions/snooze', { name: 'Bread' })).statusCode).toBe(404)
  await call('POST', '/api/suggestions/snooze', { name: 'Milk' })
  expect((await call('POST', '/api/suggestions/snooze', { name: 'Milk' })).statusCode).toBe(404) // already snoozed
})

test('snooze needs a name', async () => {
  const { call } = await userWithMilkDue()
  expect((await call('POST', '/api/suggestions/snooze', { name: '  ' })).statusCode).toBe(400)
  expect((await call('POST', '/api/suggestions/snooze', {})).statusCode).toBe(400)
})
