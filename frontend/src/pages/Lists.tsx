import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { api, useLists, type List } from '../api.ts'
import { card, Field, outlineButton, primaryButton, Skeleton } from '../ui.tsx'

const suggestions = ['Weekly groceries', 'Party', 'BBQ', 'Pharmacy', 'Hardware', 'Pets', 'Baby']

function Lists() {
  const { data: lists, isPending, isError } = useLists()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const used = new Set(lists?.map((l) => l.name.toLowerCase()))

  const create = useMutation({
    mutationFn: (name: string) => api<List>('/lists', { method: 'POST', body: { name } }),
    onSuccess: (list) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/lists/${list.id}`) // a new list is empty: go straight to adding items
    },
  })

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-tag text-4xl font-bold">Lists</h1>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(name)
        }}
      >
        <Field
          label="New list"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g. Weekly groceries"
          className="flex-1"
        />
        <button type="submit" disabled={create.isPending} className={primaryButton}>
          Add
        </button>
      </form>
      <div className="-mt-3 flex flex-wrap gap-2">
        {suggestions
          .filter((s) => !used.has(s.toLowerCase()))
          .map((s) => (
            <button key={s} type="button" onClick={() => setName(s)} className={outlineButton}>
              {s}
            </button>
          ))}
      </div>
      {create.isError && (
        <p role="alert" className="text-sm text-alarm">
          {create.error.message}
        </p>
      )}

      {isPending ? (
        <Skeleton />
      ) : isError ? (
        <p role="alert" className="text-alarm">
          Could not load your lists
        </p>
      ) : lists.length === 0 ? (
        <p className="text-ink/60">No lists yet. Create one above.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lists.map((list) => (
            <li key={list.id}>
              <Link to={`/lists/${list.id}`} className={`${card} flex flex-col gap-3 ring-ink/20 hover:ring-1`}>
                <span className="flex items-center justify-between gap-4">
                  <span className="truncate font-bold">{list.name}</span>
                  <span className="shrink-0 text-sm text-ink/60">
                    {list.total === 0 ? 'Empty list' : list.remaining === 0 ? 'All bought' : `${list.remaining} left`}
                  </span>
                </span>
                {list.total > 0 && (
                  <span
                    role="progressbar"
                    aria-label={`${list.name} progress`}
                    aria-valuenow={list.total - list.remaining}
                    aria-valuemax={list.total}
                    className="h-1 overflow-hidden rounded-full bg-ink/10"
                  >
                    <span
                      className="block h-full bg-basil"
                      style={{ width: `${((list.total - list.remaining) / list.total) * 100}%` }}
                    />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Lists
