import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { api, useLists, type List } from '../api.ts'
import { card, Field, primaryButton } from '../ui.tsx'

function Lists() {
  const { data: lists, isPending, isError } = useLists()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

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
      <h1 className="text-3xl font-semibold">Lists</h1>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(String(new FormData(e.currentTarget).get('name')))
        }}
      >
        <Field label="New list" name="name" maxLength={100} placeholder="e.g. Weekly groceries" className="flex-1" />
        <button type="submit" disabled={create.isPending} className={primaryButton}>
          Add
        </button>
      </form>
      {create.isError && (
        <p role="alert" className="text-sm text-red-500">
          {create.error.message}
        </p>
      )}

      {isPending ? (
        <p className="text-white/60">Loading…</p>
      ) : isError ? (
        <p role="alert" className="text-red-500">
          Could not load your lists
        </p>
      ) : lists.length === 0 ? (
        <p className="text-white/60">No lists yet. Create one above.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lists.map((list) => (
            <li key={list.id}>
              <Link to={`/lists/${list.id}`} className={`${card} flex items-center justify-between gap-4 hover:border-white/30`}>
                <span className="truncate font-medium">{list.name}</span>
                <span className="shrink-0 text-sm text-white/60">
                  {list.remaining === 0 ? 'Nothing to buy' : `${list.remaining} to buy`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Lists
