import type { FastifyPluginAsync } from 'fastify'
import argon2 from 'argon2'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { Prisma } from '../../generated/prisma/client.js'
import { endSession, requireUser, startSession } from '../../auth.js'

const Email = z.string().trim().toLowerCase().pipe(z.email())
const RegisterBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: Email,
  password: z.string().min(8).max(200),
})
const LoginBody = z.object({ email: Email, password: z.string() })

// Checked when the email is unknown, so both login failures take the same time.
const DUMMY_HASH = await argon2.hash('not-a-real-password')

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const body = RegisterBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: z.prettifyError(body.error) })

    const { name, email, password } = body.data
    try {
      const user = await prisma.user.create({
        data: { name, email, passwordHash: await argon2.hash(password) },
        select: { id: true, email: true, name: true },
      })
      await startSession(reply, user.id)
      return reply.code(201).send(user)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return reply.code(409).send({ error: 'Email already registered' })
      }
      throw e
    }
  })

  app.post('/login', async (request, reply) => {
    const body = LoginBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: z.prettifyError(body.error) })

    const user = await prisma.user.findUnique({ where: { email: body.data.email } })
    const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, body.data.password)
    if (!user || !ok) return reply.code(401).send({ error: 'Invalid email or password' })

    await startSession(reply, user.id)
    return { id: user.id, email: user.email, name: user.name }
  })

  app.post('/logout', async (request, reply) => {
    await endSession(request, reply)
    return reply.code(204).send()
  })

  app.get('/me', { preHandler: requireUser }, async (request) => request.user)
}
