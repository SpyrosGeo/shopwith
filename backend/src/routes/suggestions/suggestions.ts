import type { FastifyPluginAsync } from 'fastify'
import { requireUser, userId } from '../../session.js'
import { due } from '../../purchases.js'

export const suggestionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireUser)
  app.get('/', async (request) => due(userId(request), new Date()))
}
