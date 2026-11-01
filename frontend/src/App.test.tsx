import { expect, test } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { mockApi, renderApp, tess } from './test-utils.tsx'

test('logged out: landing shows catch phrase and auth link', async () => {
  mockApi({ 'GET /api/auth/me': () => [401, { error: 'Not logged in' }] })
  renderApp('/')

  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("Don't sweat it, shopwith ease.")
  expect((await screen.findByRole('link', { name: 'Log in / Register' })).getAttribute('href')).toBe('/auth')
})

test('logged in: navbar shows name, and log out returns to logged-out state', async () => {
  const fetchMock = mockApi({
    'GET /api/auth/me': () => [200, tess],
    'POST /api/auth/logout': () => [204],
  })
  renderApp('/')

  await screen.findByText('Tess')
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

  await screen.findByRole('link', { name: 'Log in / Register' })
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
})
