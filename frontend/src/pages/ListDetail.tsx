import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import {
  api,
  ApiError,
  centsToInput,
  formatEuro,
  parseEuro,
  useList,
  useListMutation,
  useProducts,
  type Item,
  type ListWithItems,
} from '../api.ts'
import { Field, outlineButton, primaryButton } from '../ui.tsx'

type ItemFields = { name: string; quantity: number; priceCents: number | null }

const PRICE_ERROR = 'Enter a price like 1.49'

function ListDetail() {
  const { id = '' } = useParams()
  const { data: list, isPending, error } = useList(id)

  if (isPending) return <p className="p-6 text-white/60">Loading…</p>
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p role="alert" className="text-red-500">
          {error instanceof ApiError && error.status === 404 ? 'List not found' : 'Could not load this list'}
        </p>
        <Link to="/lists" className="underline">
          Back to lists
        </Link>
      </div>
    )
  }

  const toBuy = list.items.filter((i) => !i.checkedAt)
  const bought = list.items.filter((i) => i.checkedAt)

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <ListHeader list={list} />
      <AddItemForm listId={list.id} />

      <div>
        <h2 className="mb-1 text-sm text-white/60">To buy ({toBuy.length})</h2>
        {toBuy.length === 0 ? (
          <p className="py-3 text-white/60">{bought.length ? 'All bought!' : 'Nothing here yet. Add an item above.'}</p>
        ) : (
          <ul>
            {toBuy.map((item) => (
              <ItemRow key={item.id} listId={list.id} item={item} />
            ))}
          </ul>
        )}
      </div>

      {bought.length > 0 && (
        <details open>
          <summary className="mb-1 min-h-11 cursor-pointer content-center text-sm text-white/60">
            Bought ({bought.length})
          </summary>
          <ul>
            {bought.map((item) => (
              <ItemRow key={item.id} listId={list.id} item={item} />
            ))}
          </ul>
        </details>
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
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Link to="/lists" className="text-sm text-white/60 hover:text-white">
          ← Lists
        </Link>
        <h1>
          <button
            type="button"
            onClick={() => setRenaming(true)}
            aria-label={`Rename ${list.name}`}
            className="max-w-full truncate text-left text-3xl font-semibold"
          >
            {list.name}
          </button>
        </h1>
      </div>
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => confirm(`Delete "${list.name}"? Your spending history is kept.`) && remove.mutate()}
        className={`${outlineButton} shrink-0 border-red-500 text-red-500 hover:bg-red-500 hover:text-white`}
      >
        Delete list
      </button>
      {(remove.isError || rename.isError) && (
        <p role="alert" className="text-sm text-red-500">
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
        <p role="alert" className="col-span-full text-sm text-red-500">
          {error || add.error?.message}
        </p>
      )}
    </form>
  )
}

function ItemRow({ listId, item }: { listId: string; item: Item }) {
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

  if (editing) return <ItemEditor listId={listId} item={item} onDone={() => setEditing(false)} />

  return (
    <li className="flex items-center gap-1 border-b border-white/10">
      {/* The whole 44px box is the tap target, not just the small checkbox */}
      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => toggle.mutate(e.target.checked)}
          aria-label={`${checked ? 'Unmark' : 'Mark'} ${item.name} as bought`}
          className="size-5 accent-red-600"
        />
      </label>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${item.name}`}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 text-left"
      >
        <span className={`truncate ${checked ? 'text-white/40 line-through' : ''}`}>
          {item.name}
          {item.quantity > 1 && <span className="text-white/60"> ×{item.quantity}</span>}
        </span>
        {item.priceCents !== null && (
          <span className="shrink-0 text-sm text-white/60">{formatEuro(item.priceCents * item.quantity)}</span>
        )}
      </button>
      {checked && item.priceCents === null && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 shrink-0 px-2 text-sm text-amber-400 hover:underline"
        >
          Add price
        </button>
      )}
      {toggle.isError && (
        <span role="alert" className="text-xs text-red-500">
          Not saved
        </span>
      )}
    </li>
  )
}

function ItemEditor({ listId, item, onDone }: { listId: string; item: Item; onDone: () => void }) {
  const [error, setError] = useState('')
  const url = `/lists/${listId}/items/${item.id}`
  const save = useListMutation(listId, (fields: ItemFields) => api(url, { method: 'PATCH', body: fields }))
  const remove = useListMutation(listId, () => api(url, { method: 'DELETE' }))

  return (
    <li className="border-b border-white/10 py-3">
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
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate(undefined)}
            className={`${outlineButton} border-red-500 text-red-500 hover:bg-red-500 hover:text-white`}
          >
            Delete
          </button>
        </div>
        {(error || save.isError || remove.isError) && (
          <p role="alert" className="col-span-3 text-sm text-red-500">
            {error || (save.error ?? remove.error)?.message}
          </p>
        )}
      </form>
    </li>
  )
}

export default ListDetail
