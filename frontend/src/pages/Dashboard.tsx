import { Link } from 'react-router'
import { formatEuro, useDashboard, type ListSummary, type MonthSpend } from '../api.ts'
import { card } from '../ui.tsx'

// Months come as UTC 'YYYY-MM' keys; format in UTC so the label never shifts a month.
const monthName = (month: string, style: 'short' | 'long') =>
  new Date(`${month}-01T00:00:00Z`).toLocaleString(undefined, { month: style, timeZone: 'UTC' })

function Dashboard() {
  const { data, isPending, isError } = useDashboard()

  if (isPending) return <p className="p-6 text-white/60">Loading…</p>
  if (isError || !data) {
    return (
      <p role="alert" className="p-6 text-red-500">
        Could not load your dashboard
      </p>
    )
  }

  const current = data.months.at(-1)!

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <div className={card}>
          <h2 className="text-sm text-white/60">Spent in {monthName(current.month, 'long')}</h2>
          <p className="mt-2 text-4xl font-bold">{formatEuro(current.totalCents)}</p>
          <p className="mt-1 text-sm text-white/60">
            {current.itemCount} {current.itemCount === 1 ? 'item' : 'items'} bought
          </p>
          {current.unpricedCount > 0 && (
            <p className="mt-1 text-sm text-amber-400">
              {current.unpricedCount} {current.unpricedCount === 1 ? 'item' : 'items'} without price
            </p>
          )}
        </div>

        <div className={card}>
          <h2 className="mb-4 text-sm text-white/60">Last {data.months.length} months</h2>
          <MonthChart months={data.months} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Active lists</h2>
        {data.activeLists.length === 0 ? (
          <p className="text-white/60">No active lists</p>
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
      {months.map((m) => (
        <li
          key={m.month}
          aria-label={`${monthName(m.month, 'long')}: ${formatEuro(m.totalCents)}`}
          className="flex h-full flex-1 flex-col items-center gap-1"
        >
          <span className="text-[10px] text-white/60 sm:text-xs">{formatEuro(m.totalCents)}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-red-600"
              // At least a sliver, so empty months still show where the axis is.
              style={{ height: `${Math.max((m.totalCents / max) * 100, 2)}%` }}
            />
          </div>
          <span className="text-xs text-white/60">{monthName(m.month, 'short')}</span>
        </li>
      ))}
    </ul>
  )
}

function ActiveListCard({ list }: { list: ListSummary }) {
  return (
    <li>
      <Link to={`/lists/${list.id}`} className={`${card} block hover:border-white/30`}>
        <h3 className="truncate font-medium">{list.name}</h3>
        <p className="mt-1 text-sm text-white/60">
          {list.total === 0 ? 'Empty list' : `${list.remaining} of ${list.total} left`}
        </p>
        {list.estimatedCents > 0 && (
          <p className="mt-1 text-sm">About {formatEuro(list.estimatedCents)} to go</p>
        )}
      </Link>
    </li>
  )
}

export default Dashboard
