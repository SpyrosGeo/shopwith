import { useState, type InputHTMLAttributes } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api, type User } from '../api.ts'

type Mode = 'login' | 'register'

function Auth() {
  const [mode, setMode] = useState<Mode>('login')
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
        <h1 className="mb-6 text-3xl font-semibold">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded border border-white/20 p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                submit.reset()
              }}
              className={`min-h-11 rounded text-sm font-medium transition-colors ${
                mode === m ? 'bg-white text-black' : 'text-white/60 hover:text-white'
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
            <p role="alert" className="text-sm text-red-500">
              {submit.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={submit.isPending}
            className="min-h-11 rounded bg-white font-medium text-black transition-opacity disabled:opacity-50"
          >
            {mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </section>
  )
}

function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm text-white/80">
      {label}
      {/* text-base (16px): iOS zooms the page when focusing inputs with smaller text */}
      <input
        required
        {...input}
        className="min-h-11 rounded border border-white/20 bg-transparent px-3 text-base text-white focus:border-white focus:outline-none"
      />
    </label>
  )
}

export default Auth
