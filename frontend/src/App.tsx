import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, useMe } from './api.ts'
import { outlineButton } from './ui.tsx'
import Landing from './pages/Landing.tsx'
import Auth from './pages/Auth.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Lists from './pages/Lists.tsx'
import ListDetail from './pages/ListDetail.tsx'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/lists', label: 'Lists' },
]

function App() {
  const { data: me, isPending: mePending } = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear() // drop all cached data, so the next user on this device never sees it
      queryClient.setQueryData(['me'], null)
      navigate('/')
    },
  })

  // Render nothing until we know who is logged in, so logged-out pages don't flash.
  const loggedIn = (page: ReactNode) => (mePending ? null : me ? page : <Navigate to="/auth" replace />)

  return (
    // dvh, not vh: mobile browsers count the area behind the address bar in 100vh
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-ink/10 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-tag text-2xl font-bold">
            shopwith
          </Link>
          {me && <Nav className="hidden gap-4 sm:flex" />}
        </div>
        {me ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-ink/60 sm:inline">{me.name}</span>
            {logout.isError && (
              <span role="alert" className="text-xs text-alarm">
                Log out failed
              </span>
            )}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className={outlineButton}
            >
              Log out
            </button>
          </div>
        ) : (
          <Link to="/auth" className={outlineButton}>
            Log in / Register
          </Link>
        )}
      </header>

      {/* Bottom padding keeps content clear of the mobile tab bar */}
      <main className={`flex flex-1 flex-col ${me ? 'pb-16 sm:pb-0' : ''}`}>
        <Routes>
          <Route path="/" element={mePending ? null : me ? <Dashboard name={me.name} /> : <Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/lists" element={loggedIn(<Lists />)} />
          <Route path="/lists/:id" element={loggedIn(<ListDetail />)} />
        </Routes>
      </main>

      {me && (
        <Nav className="fixed inset-x-0 bottom-0 grid grid-cols-2 border-t border-ink/10 bg-shelf pb-[env(safe-area-inset-bottom)] sm:hidden" />
      )}
    </div>
  )
}

function Nav({ className }: { className: string }) {
  return (
    <nav aria-label="Main" className={className}>
      {navItems.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex min-h-11 items-center justify-center text-sm font-medium ${isActive ? 'text-ink underline decoration-basil decoration-2 underline-offset-8' : 'text-ink/50 hover:text-ink'}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export default App
