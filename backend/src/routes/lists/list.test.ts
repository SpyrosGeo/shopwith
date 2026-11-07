import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../../app.js'
import { loginUser } from '../../test-helpers.js'

const app = buildApp()
afterAll(() => app.close())

async function newUser() {
  const { call } = await loginUser(app)
  type Method = Parameters<typeof call>[0]
  return { call: (method: Method, url: string, payload?: object) => call(method, `/api/lists${url}`, payload) }
}

test('requires login', async () => {
  expect((await app.inject({ method: 'GET', url: '/api/lists' })).statusCode).toBe(401)
})

test('list CRUD', async () => {
  const { call } = await newUser()

  const created = await call('POST', '/', { name: ' Weekly ' })
  expect(created.statusCode).toBe(201)
  const list = created.json()
  expect(list.name).toBe('Weekly')

  expect((await call('GET', '/')).json()).toEqual([
    { id: list.id, name: 'Weekly', createdAt: list.createdAt, remaining: 0, total: 0, estimatedCents: 0 },
  ])

  expect((await call('PATCH', `/${list.id}`, { name: 'Groceries' })).json()).toMatchObject({ name: 'Groceries' })
  expect((await call('GET', `/${list.id}`)).json()).toMatchObject({ name: 'Groceries', items: [] })

  expect((await call('DELETE', `/${list.id}`)).statusCode).toBe(204)
  expect((await call('GET', `/${list.id}`)).statusCode).toBe(404)
})

test('item add, edit, delete', async () => {
  const { call } = await newUser()
  const list = (await call('POST', '/', { name: 'L' })).json()

  const added = await call('POST', `/${list.id}/items`, { name: 'Milk' })
  expect(added.statusCode).toBe(201)
  const item = added.json()
  expect(item).toMatchObject({ name: 'Milk', quantity: 1, checkedAt: null })

  const edited = await call('PATCH', `/${list.id}/items/${item.id}`, { quantity: 3 })
  expect(edited.json()).toMatchObject({ name: 'Milk', quantity: 3 })
  expect((await call('GET', '/')).json()[0].remaining).toBe(1)

  expect((await call('DELETE', `/${list.id}/items/${item.id}`)).statusCode).toBe(204)
  expect((await call('GET', `/${list.id}`)).json().items).toEqual([])
})

// Ownership per function is covered in src/lists.test.ts; this checks the HTTP mapping (404).
test("users can't see or change other users' lists", async () => {
  const alice = await newUser()
  const bob = await newUser()
  const list = (await alice.call('POST', '/', { name: 'Private' })).json()
  const item = (await alice.call('POST', `/${list.id}/items`, { name: 'Eggs' })).json()
  const itemUrl = `/${list.id}/items/${item.id}`

  expect((await bob.call('GET', '/')).json()).toEqual([])
  expect((await bob.call('GET', `/${list.id}`)).statusCode).toBe(404)
  expect((await bob.call('PATCH', `/${list.id}`, { name: 'Hacked' })).statusCode).toBe(404)
  expect((await bob.call('POST', `/${list.id}/items`, { name: 'X' })).statusCode).toBe(404)
  expect((await bob.call('PATCH', itemUrl, { checked: true })).statusCode).toBe(404)
  expect((await bob.call('DELETE', itemUrl)).statusCode).toBe(404)
  expect((await bob.call('DELETE', `/${list.id}`)).statusCode).toBe(404)

  expect((await alice.call('GET', `/${list.id}`)).json()).toMatchObject({
    name: 'Private',
    items: [{ name: 'Eggs', checkedAt: null }],
  })
})

test('item price: set on create, change, clear with null', async () => {
  const { call } = await newUser()
  const list = (await call('POST', '/', { name: 'L' })).json()
  const item = (await call('POST', `/${list.id}/items`, { name: 'Milk', priceCents: 149 })).json()
  expect(item.priceCents).toBe(149)
  const url = `/${list.id}/items/${item.id}`

  expect((await call('PATCH', url, { quantity: 2 })).json()).toMatchObject({ quantity: 2, priceCents: 149 })
  expect((await call('PATCH', url, { priceCents: 199 })).json().priceCents).toBe(199)
  expect((await call('PATCH', url, { priceCents: null })).json().priceCents).toBeNull()
  expect((await call('POST', `/${list.id}/items`, { name: 'Eggs' })).json().priceCents).toBeNull()
})

test('invalid input is 400', async () => {
  const { call } = await newUser()
  const list = (await call('POST', '/', { name: 'L' })).json()

  expect((await call('POST', '/', { name: '   ' })).statusCode).toBe(400)
  expect((await call('POST', `/${list.id}/items`, { name: 'Milk', quantity: 0 })).statusCode).toBe(400)
  expect((await call('POST', `/${list.id}/items`, { name: 'Milk', priceCents: -1 })).statusCode).toBe(400)
  expect((await call('POST', `/${list.id}/items`, { name: 'Milk', priceCents: 1.5 })).statusCode).toBe(400)
})
