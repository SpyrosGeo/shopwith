import { createHash, randomBytes } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from './db.js'
import type { Prisma } from './generated/prisma/client.js'

const COOKIE = 'session'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// The user fields safe to send to the client. Use this select everywhere a user is returned.
export const safeUserSelect = { id: true, email: true, name: true } satisfies Prisma.UserSelect
export type SafeUser = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>

declare module 'fastify' {
  interface FastifyRequest {
    user: SafeUser | null
  }
}

// Store only the hash, so a leaked DB row can't be used as a cookie.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function startSession(reply: FastifyReply, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + MAX_AGE_MS)
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } })
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function endSession(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[COOKIE]
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } })
  reply.clearCookie(COOKIE, { path: '/' })
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[COOKIE]
  const session = token
    ? await prisma.session.findUnique({
        where: { id: hashToken(token) },
        include: { user: { select: safeUserSelect } },
      })
    : null

  if (!session || session.expiresAt < new Date()) {
    return reply.code(401).send({ error: 'Not logged in' })
  }
  request.user = session.user
}
