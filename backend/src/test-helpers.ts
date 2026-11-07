import type { FastifyInstance } from 'fastify'
import { prisma } from './db.js'

// Unique per run: the test DB is only reset once per process (watch mode reruns).
const run = Date.now()
let count = 0
const uniqueEmail = () => `test-${run}-${count++}@example.com`

// A bare user row for module tests (no session, no real password hash).
export const testUser = () => prisma.user.create({ data: { name: 'Tess', email: uniqueEmail(), passwordHash: 'x' } })

// Registers a user through the app; `call` sends requests with their session cookie.
export async function loginUser(app: FastifyInstance) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { name: 'Tess', email: uniqueEmail(), password: 'password123' },
  })
  const session = res.cookies.find((c) => c.name === 'session')!.value
  const id: string = res.json().id
  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, cookies: { session }, ...(payload && { payload }) })
  return { id, call }
}
