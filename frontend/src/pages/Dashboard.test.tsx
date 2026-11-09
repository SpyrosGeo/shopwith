import { expect, test } from 'vitest'
import { screen } from '@testing-library/react'
import { formatEuro } from '../api.ts'
import { emptyDashboard, mockApi, renderApp, tess } from '../test-utils.tsx'

const lastMonth = emptyDashboard.months.at(-1)!

test('logged in: home shows this month spend, chart and active lists', async () => {
  mockApi({
    'GET /api/auth/me': () => [200, tess],
    'GET /api/dashboard': () => [
      200,
      {
        months: [
          ...emptyDashboard.months.slice(0, -1),
          { ...lastMonth, totalCents: 1250, itemCount: 3, unpricedCount: 1 },
        ],
        activeLists: [
          { id: 'l1', name: 'Weekly', createdAt: '2026-11-01T00:00:00Z', remaining: 2, total: 5, estimatedCents: 480 },
          { id: 'l2', name: 'Party', createdAt: '2026-11-02T00:00:00Z', remaining: 0, total: 0, estimatedCents: 0 },
        ],
      },
    ],
  })
  renderApp('/')

  await screen.findByRole('heading', { name: 'Hi, Tess' })
  expect(screen.getAllByText(formatEuro(1250)).length).toBeGreaterThan(0)
  screen.getByText('3 items bought')
  screen.getByText('1 item without price')
  expect(screen.getAllByRole('listitem', { name: /:/ })).toHaveLength(6)

  expect(screen.getByRole('link', { name: /Weekly/ }).getAttribute('href')).toBe('/lists/l1')
  screen.getByText('2 of 5 left')
  screen.getByText(formatEuro(480))
  screen.getByText('Party')
  screen.getByText('Empty list')
  expect(screen.queryByText("Don't sweat it,", { exact: false })).toBeNull()
})

test('no active lists shows empty state', async () => {
  mockApi({
    'GET /api/auth/me': () => [200, tess],
    'GET /api/dashboard': () => [200, emptyDashboard],
  })
  renderApp('/')

  await screen.findByText('No active lists')
})

test('dashboard load failure shows an error', async () => {
  mockApi({
    'GET /api/auth/me': () => [200, tess],
    'GET /api/dashboard': () => [500],
  })
  renderApp('/')

  expect((await screen.findByRole('alert')).textContent).toBe('Could not load your dashboard')
})
