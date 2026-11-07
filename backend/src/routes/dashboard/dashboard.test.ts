import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../../app.js'
import { loginUser } from '../../test-helpers.js'

const app = buildApp()
afterAll(() => app.close())

async function newUser() {
  const { call } = await loginUser(app)
  const dashboard = async () => (await call('GET', '/api/dashboard')).json()
  const addList = async (name: string) => (await call('POST', '/api/lists', { name })).json()
  const addItem = async (listId: string, item: object) =>
    (await call('POST', `/api/lists/${listId}/items`, item)).json()
  const check = (listId: string, itemId: string, checked = true) =>
    call('PATCH', `/api/lists/${listId}/items/${itemId}`, { checked })
  return { call, dashboard, addList, addItem, check }
}

const thisMonth = () => new Date().toISOString().slice(0, 7)

test('requires login', async () => {
  expect((await app.inject({ method: 'GET', url: '/api/dashboard' })).statusCode).toBe(401)
})

// Month bucketing and active-list rules are covered in src/purchases.test.ts and src/lists.test.ts.
test('shape: six months ending this month, plus active lists', async () => {
  const { dashboard, addList } = await newUser()
  const list = await addList('Weekly')
  const { months, activeLists } = await dashboard()

  expect(months).toHaveLength(6)
  expect(months.at(-1)).toEqual({ month: thisMonth(), totalCents: 0, itemCount: 0, unpricedCount: 0 })
  expect(activeLists).toEqual([
    { id: list.id, name: 'Weekly', createdAt: list.createdAt, remaining: 0, total: 0, estimatedCents: 0 },
  ])
})

test('spend follows price edits after check-off and survives deleting the list', async () => {
  const { call, dashboard, addList, addItem, check } = await newUser()
  const list = await addList('Groceries')
  const milk = await addItem(list.id, { name: 'Milk', priceCents: 100 })
  await check(list.id, milk.id)

  await call('PATCH', `/api/lists/${list.id}/items/${milk.id}`, { priceCents: 120, quantity: 2 })
  expect((await dashboard()).months.at(-1).totalCents).toBe(240)

  await call('DELETE', `/api/lists/${list.id}`)
  expect((await dashboard()).months.at(-1)).toMatchObject({ totalCents: 240, itemCount: 1 })
})
