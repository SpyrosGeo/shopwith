import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireUser, userId } from '../../session.js'
import { Name } from '../../lists.js'
import { due, snooze } from '../../purchases.js'

const SuggestionBody = z.object({ name: Name })

export const suggestionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireUser)
  app.get('/', async (request) => due(userId(request), new Date()))

  app.post('/snooze', async (request, reply) => {
    const { name } = SuggestionBody.parse(request.body)
    if (!(await snooze(userId(request), name, new Date()))) return reply.code(404).send({ error: 'Not found' })
    return reply.code(204).send()
  })
}
