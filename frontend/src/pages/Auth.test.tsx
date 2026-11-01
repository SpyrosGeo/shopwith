import { expect, test } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { mockApi, renderApp, tess } from '../test-utils.tsx'

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

test('log in sends credentials, then shows the user on the landing page', async () => {
  let sent: unknown
  mockApi({
    'GET /api/auth/me': () => [401],
    'POST /api/auth/login': (body) => {
      sent = body
      return [200, tess]
    },
  })
  renderApp('/auth')

  type('Email', 'tess@example.com')
  type('Password', 'password123')
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  await screen.findByText('Tess')
  screen.getByRole('heading', { name: /Don't sweat it/ })
  expect(sent).toEqual({ email: 'tess@example.com', password: 'password123' })
})

test('register mode adds a name field and posts to /register', async () => {
  let sent: unknown
  mockApi({
    'GET /api/auth/me': () => [401],
    'POST /api/auth/register': (body) => {
      sent = body
      return [201, tess]
    },
  })
  renderApp('/auth')

  fireEvent.click(screen.getByRole('button', { name: 'Register' }))
  type('Name', 'Tess')
  type('Email', 'tess@example.com')
  type('Password', 'password123')
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

  await screen.findByText('Tess')
  expect(sent).toEqual({ name: 'Tess', email: 'tess@example.com', password: 'password123' })
})

test('server error is shown', async () => {
  mockApi({
    'GET /api/auth/me': () => [401],
    'POST /api/auth/login': () => [401, { error: 'Invalid email or password' }],
  })
  renderApp('/auth')

  type('Email', 'tess@example.com')
  type('Password', 'wrong')
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password')
})
