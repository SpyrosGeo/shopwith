import { expect, test } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { mockApi, renderApp, tess } from '../test-utils.tsx'

const weekly = { id: 'l1', name: 'Weekly', createdAt: '2026-11-01T00:00:00Z', remaining: 2, total: 3, estimatedCents: 0 }

test('shows lists with how much is left to buy', async () => {
  mockApi({
    'GET /api/auth/me': () => [200, tess],
    'GET /api/lists': () => [200, [weekly, { ...weekly, id: 'l2', name: 'Party', remaining: 0, total: 0 }]],
  })
  renderApp('/lists')

  expect((await screen.findByRole('link', { name: /Weekly/ })).getAttribute('href')).toBe('/lists/l1')
  screen.getByText('2 left')
  screen.getByText('Empty list')
})

test('creating a list opens it', async () => {
  let sent: unknown
  mockApi({
    'GET /api/auth/me': () => [200, tess],
    'GET /api/lists': () => [200, []],
    'POST /api/lists': (body) => {
      sent = body
      return [201, { id: 'l9', name: 'Party', createdAt: '2026-11-07T00:00:00Z' }]
    },
    'GET /api/lists/l9': () => [200, { id: 'l9', name: 'Party', createdAt: '2026-11-07T00:00:00Z', items: [] }],
    'GET /api/products': () => [200, []],
  })
  renderApp('/lists')

  await screen.findByText('No lists yet. Create one above.')
  fireEvent.change(screen.getByLabelText('New list'), { target: { value: 'Party' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  await screen.findByRole('button', { name: 'Rename Party' })
  expect(sent).toEqual({ name: 'Party' })
})

test('logged out: redirects to log in', async () => {
  mockApi({ 'GET /api/auth/me': () => [401] })
  renderApp('/lists')

  await screen.findByRole('heading', { name: 'Welcome back' })
})
