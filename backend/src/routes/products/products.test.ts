import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../../app.js'
import { loginUser } from '../../test-helpers.js'

const app = buildApp()
afterAll(() => app.close())

async function newUser() {
  const { call } = await loginUser(app)
  const list = (await call('POST', '/api/lists', { name: 'L' })).json()
  // Adds an item and checks it off, i.e. records one purchase.
  const buy = async (item: object) => {
    const { id } = (await call('POST', `/api/lists/${list.id}/items`, item)).json()
    await call('PATCH', `/api/lists/${list.id}/items/${id}`, { checked: true })
  }
  const products = async () => (await call('GET', '/api/products')).json()
  return { buy, products }
}

test('requires login', async () => {
  expect((await app.inject({ method: 'GET', url: '/api/products' })).statusCode).toBe(401)
})

// Grouping, ordering and price rules are covered in src/purchases.test.ts.
test('lists products from checked-off items', async () => {
  const { buy, products } = await newUser()
  await buy({ name: 'Milk', priceCents: 120 })
  expect(await products()).toEqual([{ name: 'Milk', lastPriceCents: 120 }])
})
