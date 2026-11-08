import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type User = { id: string; email: string; name: string }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  // Keep relative: the Vite dev proxy and the prod nginx both route /api to the backend.
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    // Only send a JSON header with a body: Fastify rejects an empty body declared as JSON.
    ...(init.body !== undefined && {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(init.body),
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

// Current user, or null when logged out.
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<User>('/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    retry: false,
  })
}

export type MonthSpend = { month: string; totalCents: number; itemCount: number; unpricedCount: number }
// GET /api/lists and the dashboard's active lists. remaining = items still to buy.
export type ListSummary = List & { remaining: number; total: number; estimatedCents: number }
export type Dashboard = { months: MonthSpend[]; activeLists: ListSummary[] }

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') })
}

const euro = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' })
export const formatEuro = (cents: number) => euro.format(cents / 100)

// Parses what people type in a price field: "1.49", "1,49", "€ 2", "". Returns cents, null when empty,
// or NaN when it isn't a price.
export function parseEuro(text: string): number | null {
  const clean = text.replace(/[€\s]/g, '').replace(',', '.')
  if (clean === '') return null
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Math.round(Number(clean) * 100) : NaN
}

export const centsToInput = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2))

export type List = { id: string; name: string; createdAt: string }
export type Item = {
  id: string
  name: string
  quantity: number
  priceCents: number | null
  checkedAt: string | null
  createdAt: string
}
export type ListWithItems = List & { items: Item[] }
export type Product = { name: string; lastPriceCents: number | null }

export const useLists = () => useQuery({ queryKey: ['lists'], queryFn: () => api<ListSummary[]>('/lists') })

export const useList = (id: string) =>
  useQuery({ queryKey: ['list', id], queryFn: () => api<ListWithItems>(`/lists/${id}`) })

export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('/products') })

// For every write to a list or its items: afterwards, refetch everything that shows list data.
// Pass `optimistic` to apply the change to the cached list right away (rolled back on error).
export function useListMutation<V>(
  listId: string,
  mutationFn: (vars: V) => Promise<unknown>,
  optimistic?: (list: ListWithItems, vars: V) => ListWithItems,
) {
  const queryClient = useQueryClient()
  const key = ['list', listId]
  return useMutation({
    mutationFn,
    onMutate: async (vars: V) => {
      if (!optimistic) return
      await queryClient.cancelQueries({ queryKey: key }) // so an in-flight fetch can't overwrite it
      const previous = queryClient.getQueryData<ListWithItems>(key)
      if (previous) queryClient.setQueryData(key, optimistic(previous, vars))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () =>
      Promise.all(
        [key, ['lists'], ['dashboard'], ['products']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  })
}
