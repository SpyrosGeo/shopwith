import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { z, ZodError } from 'zod'
import { Prisma } from './generated/prisma/client.js'
import { authRoutes } from './routes/auth/auth.js'
import { listRoutes } from './routes/lists/list.js'
import { dashboardRoutes } from './routes/dashboard/dashboard.js'
import { productRoutes } from './routes/products/products.js'
import { suggestionRoutes } from './routes/suggestions/suggestions.js'

export function buildApp() {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' })

  app.decorateRequest('user', null)
  app.register(cookie)

  // Set before the route plugins, so routes can throw instead of handling these themselves.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: z.prettifyError(error) })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return reply.code(404).send({ error: 'Not found' })
    }
    throw error // Fastify's default handler
  })

  app.get('/', async () => {
    return 'hello world'
  })

  app.register(authRoutes, { prefix: '/api/auth' })
  app.register(listRoutes, { prefix: '/api/lists' })
  app.register(dashboardRoutes, { prefix: '/api/dashboard' })
  app.register(productRoutes, { prefix: '/api/products' })
  app.register(suggestionRoutes, { prefix: '/api/suggestions' })

  return app
}
