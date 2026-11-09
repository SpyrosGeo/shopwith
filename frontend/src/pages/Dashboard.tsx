import { Link } from 'react-router'
import { formatEuro, useDashboard, type ListSummary, type MonthSpend } from '../api.ts'
import { card, Price, Skeleton } from '../ui.tsx'

// Months come as UTC 'YYYY-MM' keys; format in UTC so the label never shifts a month.
const monthName = (month: string, style: 'short' | 'long') =>
  new Date(`${month}-01T00:00:00Z`).toLocaleString(undefined, { month: style, timeZone: 'UTC' })

function Dashboard({ name }: { name: string }) {
  const { data, isPending, isError } = useDashboard()

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton />
      </section>
    )
  }
  if (isError || !data) {
    return (
      <p role="alert" className="p-6 text-alarm">
        Could not load your dashboard
      </p>
    )
  }

  const current = data.months.at(-1)!

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-tag text-4xl font-bold">Hi, {name}</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <div className={card}>
          <h2 className="text-sm text-ink/60">Spent in {monthName(current.month, 'long')}</h2>
          <p className="mt-3">
            <Price cents={current.totalCents} size="lg" />
          </p>
          <p className="mt-3 text-sm text-ink/60">
            {current.itemCount} {current.itemCount === 1 ? 'item' : 'items'} bought
          </p>
          {current.unpricedCount > 0 && (
            <p className="mt-1 flex items-center gap-2 text-sm">
              <span aria-hidden className="size-2 bg-tag" />
              {current.unpricedCount} {current.unpricedCount === 1 ? 'item' : 'items'} without price
            </p>
          )}
        </div>

        <div className={card}>
          <h2 className="mb-4 text-sm text-ink/60">Last {data.months.length} months</h2>
          <MonthChart months={data.months} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-tag text-2xl font-bold">Active lists</h2>
        {data.activeLists.length === 0 ? (
          <p className="text-ink/60">No active lists</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.activeLists.map((list) => (
              <ActiveListCard key={list.id} list={list} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function MonthChart({ months }: { months: MonthSpend[] }) {
  const max = Math.max(...months.map((m) => m.totalCents), 1)
  return (
    <ul className="flex h-40 items-end gap-2">
      {months.map((m, i) => {
        const isCurrent = i === months.length - 1
        return (
          <li
            key={m.month}
            aria-label={`${monthName(m.month, 'long')}: ${formatEuro(m.totalCents)}`}
            className="flex h-full flex-1 flex-col items-center gap-1"
          >
            {/* Past months' amounts only from sm up: on a phone six labels collide */}
            <span className={`text-xs tabular-nums ${isCurrent ? 'font-bold' : 'hidden text-ink/60 sm:inline'}`}>
              {formatEuro(m.totalCents)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-sm ${isCurrent ? 'bg-basil' : 'bg-ink/20'}`}
                // At least a sliver, so empty months still show where the axis is.
                style={{ height: `${Math.max((m.totalCents / max) * 100, 2)}%` }}
              />
            </div>
            <span className={`text-xs ${isCurrent ? 'font-bold' : 'text-ink/60'}`}>{monthName(m.month, 'short')}</span>
          </li>
        )
      })}
    </ul>
  )
}

function ActiveListCard({ list }: { list: ListSummary }) {
  return (
    <li>
      <Link to={`/lists/${list.id}`} className={`${card} block ring-ink/20 hover:ring-1`}>
        <h3 className="truncate font-bold">{list.name}</h3>
        <p className="mt-1 text-sm text-ink/60">
          {list.total === 0 ? 'Empty list' : `${list.remaining} of ${list.total} left`}
        </p>
        {list.estimatedCents > 0 && (
          <p className="mt-2 flex items-center gap-2 text-sm">
            About <Price cents={list.estimatedCents} /> to go
          </p>
        )}
      </Link>
    </li>
  )
}

export default Dashboard
