import { Link, Route, Routes, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, useMe } from './api.ts'
import Landing from './pages/Landing.tsx'
import Auth from './pages/Auth.tsx'

const outlineButton =
  'inline-flex min-h-11 items-center rounded border border-white px-4 text-sm font-medium transition-colors hover:bg-white hover:text-black'

function App() {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null)
      navigate('/')
    },
  })

  return (
    // dvh, not vh: mobile browsers count the area behind the address bar in 100vh
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="text-xl font-bold tracking-tight">
          shopwith
        </Link>
        {me ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm text-white/60">{me.name}</span>
            <button type="button" onClick={() => logout.mutate()} className={outlineButton}>
              Log out
            </button>
          </div>
        ) : (
          <Link to="/auth" className={outlineButton}>
            Log in / Register
          </Link>
        )}
      </header>

      <main className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
