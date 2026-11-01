import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { authRoutes } from './routes/auth/auth.js'

export function buildApp() {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' })

  app.decorateRequest('user', null)
  app.register(cookie)

  app.get('/', async () => {
    return 'hello world'
  })

  app.register(authRoutes, { prefix: '/api/auth' })

  return app
}
