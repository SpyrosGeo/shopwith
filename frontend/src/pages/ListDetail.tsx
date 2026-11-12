import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import {
  api,
  ApiError,
  centsToInput,
  parseEuro,
  useList,
  useListMutation,
  useProducts,
  type Item,
  type ListWithItems,
} from '../api.ts'
import { dangerButton, Field, outlineButton, Price, primaryButton, Skeleton, Toast, TrashIcon } from '../ui.tsx'

type ItemFields = { name: string; quantity: number; priceCents: number | null }

const PRICE_ERROR = 'Enter a price like 1.49'
const UNDO_MS = 5000

function ListDetail() {
  const { id = '' } = useParams()
  const { data: list, isPending, error } = useList(id)
  const queryClient = useQueryClient()

  // Item deletes wait UNDO_MS before reaching the server; until then the item is only hidden.
  const [pending, setPending] = useState<Item | null>(null)
  const timer = useRef<{ itemId: string; handle: ReturnType<typeof setTimeout> } | null>(null)
  const removeItem = useListMutation(id, (itemId: string) => api(`/lists/${id}/items/${itemId}`, { method: 'DELETE' }))

  const commitDelete = () => {
    if (!timer.current) return
    clearTimeout(timer.current.handle)
    removeItem.mutate(timer.current.itemId)
    timer.current = null
    setPending(null)
  }
  const deleteItem = (item: Item) => {
    commitDelete() // a second delete sends the first one right away
    timer.current = { itemId: item.id, handle: setTimeout(commitDelete, UNDO_MS) }
    setPending(item)
  }
  const undo = () => {
    if (timer.current) clearTimeout(timer.current.handle)
    timer.current = null
    setPending(null)
  }

  // Leaving the page sends a pending delete instead of dropping it.
  useEffect(
    () => () => {
      if (!timer.current) return
      clearTimeout(timer.current.handle)
      api(`/lists/${id}/items/${timer.current.itemId}`, { method: 'DELETE' }).finally(() =>
        [['list', id], ['lists'], ['dashboard']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      timer.current = null
    },
    [id, queryClient],
  )

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Skeleton />
      </section>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p role="alert" className="text-alarm">
          {error instanceof ApiError && error.status === 404 ? 'List not found' : 'Could not load this list'}
        </p>
        <Link to="/lists" className="underline">
          Back to lists
        </Link>
      </div>
    )
  }

  const items = list.items.filter((i) => i.id !== pending?.id)
  const toBuy = items.filter((i) => !i.checkedAt)
  const bought = items.filter((i) => i.checkedAt)
  const toGoCents = toBuy.reduce((sum, i) => sum + (i.priceCents ?? 0) * i.quantity, 0)

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-6 sm:px-6 sm:pt-8">
      <ListHeader list={list} />

      {items.length > 0 && (
        <p className="-mt-4 flex flex-wrap items-center gap-2 text-ink/70">
          {toBuy.length} of {items.length} left
          {toGoCents > 0 && (
            <>
              <Price cents={toGoCents} /> to go
            </>
          )}
        </p>
      )}

      <div>
        <h2 className="mb-2 text-sm text-ink/60">To buy ({toBuy.length})</h2>
        {toBuy.length === 0 ? (
          <p className="py-3 text-ink/60">{bought.length ? 'All bought!' : 'Nothing here yet. Add your first item below.'}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {toBuy.map((item) => (
              <ItemRow key={item.id} listId={list.id} item={item} onDelete={deleteItem} />
            ))}
          </ul>
        )}
      </div>

      {bought.length > 0 && (
        // Collapsed while shopping, open once everything is bought.
        <details open={toBuy.length === 0}>
          <summary className="mb-2 min-h-11 cursor-pointer content-center text-sm text-ink/60">
            Bought ({bought.length})
          </summary>
          <ul className="flex flex-col gap-1">
            {bought.map((item) => (
              <ItemRow key={item.id} listId={list.id} item={item} onDelete={deleteItem} />
            ))}
          </ul>
        </details>
      )}

      {removeItem.isError && (
        <p role="alert" className="text-sm text-alarm">
          {removeItem.error.message}
        </p>
      )}

      {/* mt-auto + sticky: sits at the bottom of the page, in thumb reach, above the mobile tab bar */}
      <div className="sticky bottom-[calc(2.75rem+1px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto border-t border-ink/10 bg-aisle/95 px-4 py-3 backdrop-blur sm:bottom-0 sm:-mx-6 sm:px-6">
        <AddItemForm listId={list.id} />
      </div>

      {pending && (
        <Toast>
          <span className="truncate">Deleted {pending.name}</span>
          <button type="button" onClick={undo} className="min-h-11 shrink-0 px-2 font-bold text-tag">
            Undo
          </button>
        </Toast>
      )}
    </section>
  )
}

function ListHeader({ list }: { list: ListWithItems }) {
  const [renaming, setRenaming] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const rename = useListMutation(list.id, (name: string) =>
    api(`/lists/${list.id}`, { method: 'PATCH', body: { name } }),
  )
  // Not useListMutation: that would refetch the list we just deleted.
  const remove = useMutation({
    mutationFn: () => api(`/lists/${list.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['list', list.id] })
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/lists')
    },
  })

  if (renaming) {
    return (
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          rename.mutate(String(new FormData(e.currentTarget).get('name')), { onSuccess: () => setRenaming(false) })
        }}
      >
        <Field label="List name" name="name" defaultValue={list.name} maxLength={100} autoFocus className="flex-1" />
        <button type="submit" disabled={rename.isPending} className={primaryButton}>
          Save
        </button>
        <button type="button" onClick={() => setRenaming(false)} className={outlineButton}>
          Cancel
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link to="/lists" className="self-start text-sm text-ink/60 hover:text-ink">
        ← Lists
      </Link>
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 truncate font-tag text-4xl font-bold">{list.name}</h1>
        <details className="relative shrink-0">
          <summary
            aria-label="List options"
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-2xl leading-none hover:bg-ink/5 [&::-webkit-details-marker]:hidden"
          >
            ⋯
          </summary>
          <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col gap-2 rounded-md bg-shelf p-2 shadow-lg ring-1 ring-ink/10">
            <button type="button" onClick={() => setRenaming(true)} aria-label={`Rename ${list.name}`} className={outlineButton}>
              Rename
            </button>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => confirm(`Delete "${list.name}"? Your spending history is kept.`) && remove.mutate()}
              className={dangerButton}
            >
              Delete list
            </button>
          </div>
        </details>
      </div>
      {(remove.isError || rename.isError) && (
        <p role="alert" className="text-sm text-alarm">
          {(remove.error ?? rename.error)?.message}
        </p>
      )}
    </div>
  )
}

function AddItemForm({ listId }: { listId: string }) {
  const { data: products = [] } = useProducts()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [error, setError] = useState('')

  const add = useListMutation(listId, (item: ItemFields) =>
    api(`/lists/${listId}/items`, { method: 'POST', body: item }),
  )

  const onNameChange = (value: string) => {
    setName(value)
    if (priceTouched) return
    // Pre-fill the last price paid for a product the user has bought before.
    const key = value.trim().toLowerCase()
    const match = products.find((p) => p.name.toLowerCase() === key)
    setPrice(centsToInput(match?.lastPriceCents ?? null))
  }

  return (
    <form
      className="grid grid-cols-[4.5rem_1fr_auto] items-end gap-2 sm:grid-cols-[1fr_4.5rem_6rem_auto]"
      onSubmit={(e) => {
        e.preventDefault()
        const priceCents = parseEuro(price)
        if (Number.isNaN(priceCents)) return setError(PRICE_ERROR)
        setError('')
        add.mutate(
          { name, quantity: Number(quantity), priceCents },
          {
            onSuccess: () => {
              setName('')
              setQuantity('1')
              setPrice('')
              setPriceTouched(false)
            },
          },
        )
      }}
    >
      <Field
        label="Item"
        list={`products-${listId}`}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={100}
        autoComplete="off"
        className="col-span-3 sm:col-span-1"
      />
      <datalist id={`products-${listId}`}>
        {products.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>
      <Field
        label="Qty"
        type="number"
        min={1}
        max={999}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <Field
        label="Price €"
        inputMode="decimal"
        required={false}
        placeholder="optional"
        value={price}
        onChange={(e) => {
          setPrice(e.target.value)
          setPriceTouched(true)
        }}
      />
      <button type="submit" disabled={add.isPending} className={primaryButton}>
        Add
      </button>
      {(error || add.isError) && (
        <p role="alert" className="col-span-full text-sm text-alarm">
          {error || add.error?.message}
        </p>
      )}
    </form>
  )
}

function ItemRow({ listId, item, onDelete }: { listId: string; item: Item; onDelete: (item: Item) => void }) {
  const [editing, setEditing] = useState(false)
  const checked = item.checkedAt !== null

  const toggle = useListMutation(
    listId,
    (check: boolean) => api(`/lists/${listId}/items/${item.id}`, { method: 'PATCH', body: { checked: check } }),
    (list, check) => ({
      ...list,
      items: list.items.map((i) =>
        i.id === item.id ? { ...i, checkedAt: check ? (i.checkedAt ?? new Date().toISOString()) : null } : i,
      ),
    }),
  )

  if (editing) return <ItemEditor listId={listId} item={item} onDone={() => setEditing(false)} onDelete={onDelete} />

  return (
    <li className="flex items-center gap-1 rounded-sm bg-shelf">
      {/* The whole 44px box is the tap target, not just the small checkbox */}
      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => toggle.mutate(e.target.checked)}
          aria-label={`${checked ? 'Unmark' : 'Mark'} ${item.name} as bought`}
          className="size-5 accent-basil"
        />
      </label>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${item.name}`}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 text-left"
      >
        <span className={`truncate ${checked ? 'text-ink/40 line-through' : ''}`}>
          {item.name}
          {item.quantity > 1 && <span className="text-ink/60"> ×{item.quantity}</span>}
        </span>
        {item.priceCents !== null && <Price cents={item.priceCents * item.quantity} />}
      </button>
      {checked && item.priceCents === null && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 shrink-0 px-2 text-sm underline decoration-tag decoration-2 underline-offset-4"
        >
          Add price
        </button>
      )}
      {toggle.isError && (
        <span role="alert" className="text-xs text-alarm">
          Not saved
        </span>
      )}
      <button
        type="button"
        onClick={() => onDelete(item)}
        aria-label={`Delete ${item.name}`}
        className="flex size-11 shrink-0 items-center justify-center text-ink/40 transition-colors hover:text-alarm"
      >
        <TrashIcon />
      </button>
    </li>
  )
}

function ItemEditor({
  listId,
  item,
  onDone,
  onDelete,
}: {
  listId: string
  item: Item
  onDone: () => void
  onDelete: (item: Item) => void
}) {
  const [error, setError] = useState('')
  const save = useListMutation(listId, (fields: ItemFields) =>
    api(`/lists/${listId}/items/${item.id}`, { method: 'PATCH', body: fields }),
  )

  return (
    <li className="rounded-sm bg-shelf p-3">
      <form
        className="grid grid-cols-[1fr_4.5rem_6rem] items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const priceCents = parseEuro(String(form.get('price')))
          if (Number.isNaN(priceCents)) return setError(PRICE_ERROR)
          setError('')
          save.mutate(
            { name: String(form.get('name')), quantity: Number(form.get('quantity')), priceCents },
            { onSuccess: onDone },
          )
        }}
      >
        <Field label="Item" name="name" defaultValue={item.name} maxLength={100} autoFocus className="col-span-3" />
        <Field label="Qty" name="quantity" type="number" min={1} max={999} defaultValue={item.quantity} />
        <Field
          label="Price €"
          name="price"
          inputMode="decimal"
          required={false}
          placeholder="optional"
          defaultValue={centsToInput(item.priceCents)}
          className="col-span-2"
        />
        <div className="col-span-3 flex gap-2">
          <button type="submit" disabled={save.isPending} className={`${primaryButton} flex-1`}>
            Save
          </button>
          <button type="button" onClick={onDone} className={outlineButton}>
            Cancel
          </button>
          <button type="button" onClick={() => onDelete(item)} className={dangerButton}>
            Delete
          </button>
        </div>
        {(error || save.isError) && (
          <p role="alert" className="col-span-3 text-sm text-alarm">
            {error || save.error?.message}
          </p>
        )}
      </form>
    </li>
  )
}

export default ListDetail
