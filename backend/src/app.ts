import Fastify from 'fastify'

export function buildApp() {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' })

  app.get('/', async () => {
    return 'hello world'
  })

  return app
}
