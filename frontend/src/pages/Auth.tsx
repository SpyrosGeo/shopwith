import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { api, type User } from '../api.ts'
import { Field, primaryButton } from '../ui.tsx'

type Mode = 'login' | 'register'

function Auth() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const submit = useMutation({
    mutationFn: (body: Record<string, FormDataEntryValue>) =>
      api<User>(`/auth/${mode}`, { method: 'POST', body }),
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user)
      navigate('/')
    },
  })

  return (
    <section className="flex flex-1 justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 font-tag text-4xl font-bold">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-shelf p-1 ring-1 ring-ink/10">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                submit.reset()
              }}
              className={`min-h-11 rounded-full text-sm font-medium transition-colors ${
                mode === m ? 'bg-ink text-aisle' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {m === 'login' ? 'Log in' : 'Register'}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit.mutate(Object.fromEntries(new FormData(e.currentTarget)))
          }}
        >
          {mode === 'register' && <Field label="Name" name="name" autoComplete="name" />}
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field
            label="Password"
            name="password"
            type="password"
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {submit.error && (
            <p role="alert" className="text-sm text-alarm">
              {submit.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={submit.isPending}
            className={primaryButton}
          >
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default Auth
