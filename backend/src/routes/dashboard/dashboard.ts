import type { FastifyPluginAsync } from 'fastify'
import { requireUser, userId } from '../../session.js'
import { monthlySpend } from '../../purchases.js'
import { listSummaries } from '../../lists.js'

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireUser)

  app.get('/', async (request) => {
    const uid = userId(request)
    const [months, activeLists] = await Promise.all([monthlySpend(uid), listSummaries(uid, { activeOnly: true })])
    return { months, activeLists }
  })
}
