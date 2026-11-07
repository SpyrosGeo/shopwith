import type { FastifyPluginAsync } from 'fastify'
import { requireUser, userId } from '../../session.js'
import {
  addItem,
  ItemPatch,
  ListBody,
  NewItem,
  createList,
  deleteList,
  getList,
  listSummaries,
  removeItem,
  renameList,
  updateItem,
} from '../../lists.js'

type ListParams = { Params: { id: string } }
type ItemParams = { Params: { id: string; itemId: string } }

export const listRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireUser)

  app.get('/', async (request) => listSummaries(userId(request)))

  app.post('/', async (request, reply) => {
    const { name } = ListBody.parse(request.body)
    return reply.code(201).send(await createList(userId(request), name))
  })

  app.get<ListParams>('/:id', async (request) => getList(userId(request), request.params.id))

  app.patch<ListParams>('/:id', async (request) => {
    const { name } = ListBody.parse(request.body)
    return renameList(userId(request), request.params.id, name)
  })

  app.delete<ListParams>('/:id', async (request, reply) => {
    await deleteList(userId(request), request.params.id)
    return reply.code(204).send()
  })

  app.post<ListParams>('/:id/items', async (request, reply) => {
    const data = NewItem.parse(request.body)
    return reply.code(201).send(await addItem(userId(request), request.params.id, data))
  })

  app.patch<ItemParams>('/:id/items/:itemId', async (request) => {
    const patch = ItemPatch.parse(request.body)
    return updateItem(userId(request), request.params.id, request.params.itemId, patch)
  })

  app.delete<ItemParams>('/:id/items/:itemId', async (request, reply) => {
    await removeItem(userId(request), request.params.id, request.params.itemId)
    return reply.code(204).send()
  })
}
