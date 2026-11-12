import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireUser, userId } from '../../session.js'
import { addToNewestActiveList, Name } from '../../lists.js'
import { due, productKey, snooze } from '../../purchases.js'

const SuggestionBody = z.object({ name: Name })

export const suggestionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireUser)
  app.get('/', async (request) => due(userId(request), new Date()))

  app.post('/snooze', async (request, reply) => {
    const { name } = SuggestionBody.parse(request.body)
    if (!(await snooze(userId(request), name, new Date()))) return reply.code(404).send({ error: 'Not found' })
    return reply.code(204).send()
  })

  app.post('/add', async (request, reply) => {
    const { name } = SuggestionBody.parse(request.body)
    const key = productKey(name)
    const product = (await due(userId(request), new Date())).find((s) => productKey(s.name) === key)
    if (!product) return reply.code(404).send({ error: 'Not found' })
    const added = await addToNewestActiveList(userId(request), {
      name: product.name,
      quantity: 1,
      priceCents: product.lastPriceCents,
    })
    return reply.code(201).send(added)
  })
}
