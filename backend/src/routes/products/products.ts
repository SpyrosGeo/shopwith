import type { FastifyPluginAsync } from 'fastify'
import { requireUser, userId } from '../../session.js'
import { products } from '../../purchases.js'

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireUser)

  app.get('/', async (request) => products(userId(request)))
}
