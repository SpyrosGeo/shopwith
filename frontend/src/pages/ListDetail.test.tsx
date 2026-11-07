import { expect, test, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Item } from '../api.ts'
import { mockApi, renderApp, tess } from '../test-utils.tsx'

const item = (fields: Partial<Item>): Item => ({
  id: 'i1',
  name: 'Milk',
  quantity: 1,
  priceCents: null,
  checkedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  ...fields,
})

// A fake list backend; returns the request bodies it received, keyed by route.
function setup(initialItems: Item[], products = [{ name: 'Oat Milk', lastPriceCents: 189 }]) {
  let items = initialItems
  const sent: Record<string, unknown> = {}
  const record = (key: string, status: number, data?: unknown) => (body: unknown) => {
    sent[key] = body
    return [status, data] as [number, unknown]
  }
  const fetchMock = mockApi({
    'GET /api/auth/me': () => [200, tess],
    'GET /api/lists/l1': () => [200, { id: 'l1', name: 'Weekly', createdAt: '2026-11-01T00:00:00Z', items }],
    'GET /api/lists': () => [200, []],
    'GET /api/products': () => [200, products],
    'POST /api/lists/l1/items': record('add', 201, item({})),
    'PATCH /api/lists/l1/items/i1': (body) => {
      sent['patch'] = body
      const { checked } = body as { checked?: boolean }
      // Like the server: checking sets checkedAt, so refetches agree with the optimistic update.
      if (checked !== undefined) items = items.map((i) => ({ ...i, checkedAt: checked ? '2026-11-07T10:00:00Z' : null }))
      return [200, items[0]]
    },
    'DELETE /api/lists/l1/items/i1': record('deleteItem', 204),
    'DELETE /api/lists/l1': record('deleteList', 204),
    'PATCH /api/lists/l1': record('rename', 200, {}),
  })
  renderApp('/lists/l1')
  return { sent, fetchMock }
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

// The open inline editor: the add form has fields with the same labels.
const editor = () => within(screen.getByRole('button', { name: 'Save' }).closest('form')!)
const typeInEditor = (label: string, value: string) =>
  fireEvent.change(editor().getByLabelText(label), { target: { value } })

test('add item: price pre-filled from the last purchase of that product', async () => {
  const { sent } = setup([])
  await screen.findByText('Nothing here yet. Add an item above.')
  await waitFor(() => expect(document.querySelectorAll('datalist option')).toHaveLength(1))

  type('Item', 'oat milk')
  expect((screen.getByLabelText('Price €') as HTMLInputElement).value).toBe('1.89')
  type('Qty', '2')
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  await waitFor(() => expect(sent['add']).toEqual({ name: 'oat milk', quantity: 2, priceCents: 189 }))
})

test('add item: a typed price wins over the pre-fill, and bad prices are rejected', async () => {
  const { sent } = setup([])
  await screen.findByText('Nothing here yet. Add an item above.')

  type('Price €', 'abc')
  type('Item', 'Oat Milk')
  expect((screen.getByLabelText('Price €') as HTMLInputElement).value).toBe('abc')
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Enter a price like 1.49')
  expect(sent['add']).toBeUndefined()

  type('Price €', '2,5')
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  await waitFor(() => expect(sent['add']).toEqual({ name: 'Oat Milk', quantity: 1, priceCents: 250 }))
})

test('checking an item off moves it to Bought right away', async () => {
  const { sent } = setup([item({ priceCents: 120, quantity: 2 })])
  await screen.findByText('To buy (1)')
  screen.getByText(/2\.40/)

  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Milk as bought' }))

  await screen.findByText('Bought (1)')
  screen.getByText('All bought!')
  expect(sent['patch']).toEqual({ checked: true })
})

test('bought item without price offers "Add price", which opens the editor', async () => {
  const { sent } = setup([item({ checkedAt: '2026-11-07T10:00:00Z' })])
  fireEvent.click(await screen.findByRole('button', { name: 'Add price' }))

  typeInEditor('Price €', '0.99')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(sent['patch']).toEqual({ name: 'Milk', quantity: 1, priceCents: 99 }))
})

test('edit and delete an item from the inline editor', async () => {
  const { sent } = setup([item({ priceCents: 100 })])
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Milk' }))

  expect((editor().getByLabelText('Price €') as HTMLInputElement).value).toBe('1.00')
  typeInEditor('Price €', '')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(sent['patch']).toEqual({ name: 'Milk', quantity: 1, priceCents: null }))

  fireEvent.click(await screen.findByRole('button', { name: 'Edit Milk' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect('deleteItem' in sent).toBe(true))
})

test('delete list asks first, then goes back to lists', async () => {
  const confirm = vi.fn(() => false)
  vi.stubGlobal('confirm', confirm)
  const { sent } = setup([])
  fireEvent.click(await screen.findByRole('button', { name: 'Delete list' }))
  expect(confirm).toHaveBeenCalled()
  expect('deleteList' in sent).toBe(false)

  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Delete list' }))
  await screen.findByRole('heading', { name: 'Lists' })
  expect('deleteList' in sent).toBe(true)
})

test('rename list', async () => {
  const { sent } = setup([])
  fireEvent.click(await screen.findByRole('button', { name: 'Rename Weekly' }))
  type('List name', 'Groceries')
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(sent['rename']).toEqual({ name: 'Groceries' }))
})

test('unknown list shows not found', async () => {
  mockApi({ 'GET /api/auth/me': () => [200, tess] })
  renderApp('/lists/nope')
  expect((await screen.findByRole('alert')).textContent).toBe('List not found')
})
