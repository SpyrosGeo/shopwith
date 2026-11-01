import { afterAll, expect, test } from 'vitest'
import { buildApp } from '../../app.js'

const app = buildApp()
afterAll(() => app.close())

// The test DB is only reset once per process; unique emails keep watch-mode reruns from hitting 409s.
const run = Date.now()
const email = (name: string) => `${name}-${run}@example.com`

const register = (email: string, password = 'password123') =>
  app.inject({ method: 'POST', url: '/api/auth/register', payload: { name: 'Tess', email, password } })

const login = (email: string, password: string) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })

const me = (session?: string) =>
  app.inject({ method: 'GET', url: '/api/auth/me', cookies: session ? { session } : {} })

const sessionCookie = (res: Awaited<ReturnType<typeof register>>) =>
  res.cookies.find((c) => c.name === 'session')

test('register, me, logout', async () => {
  const reg = await register(email('flow'))
  expect(reg.statusCode).toBe(201)
  expect(reg.json()).toEqual({ id: expect.any(String), email: email('flow'), name: 'Tess' })

  const cookie = sessionCookie(reg)
  expect(cookie?.httpOnly).toBe(true)
  const session = cookie!.value

  expect((await me(session)).json()).toMatchObject({ email: email('flow') })

  const out = await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { session } })
  expect(out.statusCode).toBe(204)
  expect((await me(session)).statusCode).toBe(401)
})

test('register normalizes email and rejects duplicates', async () => {
  expect((await register(`  Dupe-${run}@Example.com `)).json()).toMatchObject({ email: email('dupe') })
  expect((await register(email('dupe'))).statusCode).toBe(409)
})

test('register rejects invalid body', async () => {
  expect((await register('not-an-email')).statusCode).toBe(400)
  expect((await register(email('short'), 'short')).statusCode).toBe(400)
})

test('login: wrong password and unknown email look the same', async () => {
  await register(email('login'))
  const wrongPassword = await login(email('login'), 'wrong-password')
  const unknownEmail = await login('nobody@example.com', 'password123')

  expect(wrongPassword.statusCode).toBe(401)
  expect(unknownEmail.statusCode).toBe(401)
  expect(wrongPassword.body).toBe(unknownEmail.body)
})

test('login rejects passwords over 200 characters', async () => {
  expect((await login(email('long'), 'x'.repeat(201))).statusCode).toBe(400)
})

test('login with correct password starts a session', async () => {
  await register(email('ok'))
  const res = await login(email('ok'), 'password123')

  expect(res.statusCode).toBe(200)
  expect(res.json()).toEqual({ id: expect.any(String), email: email('ok'), name: 'Tess' })
  expect((await me(sessionCookie(res)!.value)).json()).toMatchObject({ email: email('ok') })
})

test('me without cookie is 401', async () => {
  expect((await me()).statusCode).toBe(401)
})
