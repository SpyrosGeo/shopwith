import { expect, test } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { emptyDashboard, mockApi, renderApp, tess } from './test-utils.tsx'

test('logged out: landing shows catch phrase and auth links', async () => {
  mockApi({ 'GET /api/auth/me': () => [401, { error: 'Not logged in' }] })
  renderApp('/')

  expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe("Don't sweat it, shopwith ease.")
  expect((await screen.findByRole('link', { name: 'Log in / Register' })).getAttribute('href')).toBe('/auth')
  expect(screen.getByRole('link', { name: 'Create account' }).getAttribute('href')).toBe('/auth?mode=register')
})

test('auth opens in register mode from the landing link', async () => {
  mockApi({ 'GET /api/auth/me': () => [401] })
  renderApp('/auth?mode=register')

  await screen.findByRole('heading', { name: 'Create your account' })
  screen.getByLabelText('Name')
})

test('logged in: navbar shows name, and log out returns to logged-out state', async () => {
  const fetchMock = mockApi({
    'GET /api/auth/me': () => [200, tess],
    'GET /api/dashboard': () => [200, emptyDashboard],
    'POST /api/auth/logout': () => [204],
  })
  renderApp('/')

  await screen.findByText('Tess')
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

  await screen.findByRole('link', { name: 'Log in / Register' })
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
})

test('failed log out shows an error and keeps the user logged in', async () => {
  mockApi({
    'GET /api/auth/me': () => [200, tess],
    'GET /api/dashboard': () => [200, emptyDashboard],
    'POST /api/auth/logout': () => [500],
  })
  renderApp('/')

  await screen.findByText('Tess')
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

  expect((await screen.findByRole('alert')).textContent).toBe('Log out failed')
  screen.getByText('Tess')
})

test('theme toggle cycles System, Light, Dark and remembers the choice', async () => {
  mockApi({ 'GET /api/auth/me': () => [401] })
  renderApp('/')
  const html = document.documentElement

  const toggle = await screen.findByRole('button', { name: 'Theme: System (switch to Light)' })
  expect(html.dataset.theme).toBe('dark') // stub OS reports dark

  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-label')).toBe('Theme: Light (switch to Dark)')
  expect(html.dataset.theme).toBe('light')
  expect(localStorage.getItem('theme')).toBe('light')

  fireEvent.click(toggle)
  expect(html.dataset.theme).toBe('dark')
  expect(localStorage.getItem('theme')).toBe('dark')

  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-label')).toBe('Theme: System (switch to Light)')
  expect(localStorage.getItem('theme')).toBeNull()
})
