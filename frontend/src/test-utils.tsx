import { vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import App from './App.tsx'

export function renderApp(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

type Handler = (body: unknown) => [status: number, data?: unknown]

// Fake backend: keys are "METHOD /api/path". Unlisted requests get 404.
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const handler = routes[`${init?.method ?? 'GET'} ${url}`]
    if (!handler) return new Response(null, { status: 404 })
    const [status, data] = handler(init?.body ? JSON.parse(init.body as string) : undefined)
    return new Response(data === undefined ? null : JSON.stringify(data), { status })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const tess = { id: 'u1', email: 'tess@example.com', name: 'Tess' }

const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
export const emptyDashboard = {
  months: months.map((month) => ({ month, totalCents: 0, itemCount: 0, unpricedCount: 0 })),
  activeLists: [],
}
