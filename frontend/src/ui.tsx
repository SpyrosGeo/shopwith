import type { InputHTMLAttributes, ReactNode } from 'react'
import { formatEuro } from './api.ts'

export const outlineButton =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-ink/30 px-4 text-sm font-medium transition-colors hover:bg-ink/5 disabled:opacity-50'

export const primaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-medium text-aisle transition-colors hover:bg-accent/85 active:bg-accent disabled:opacity-50'

export const dangerButton =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-alarm px-4 text-sm font-medium text-alarm transition-colors hover:bg-alarm hover:text-aisle disabled:opacity-50'

export const card = 'rounded-md bg-shelf p-4 sm:p-6'

// Required by default; pass required={false} for optional fields.
export function Field({ label, className = '', ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-ink/70 ${className}`}>
      {label}
      {/* text-base (16px): iOS zooms the page when focusing inputs with smaller text */}
      <input
        required
        {...input}
        className="min-h-11 w-full rounded-md border border-ink/20 bg-shelf px-3 text-base text-ink focus:border-ink"
      />
    </label>
  )
}

// Every euro amount renders as a shelf tag: square, yellow, condensed numerals.
export function Price({ cents, size = 'sm' }: { cents: number; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={`inline-block bg-tag font-tag font-bold tabular-nums text-aisle ${size === 'lg' ? 'px-3 py-1 text-5xl' : 'px-1.5 text-base'}`}
    >
      {formatEuro(cents)}
    </span>
  )
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-md bg-shelf px-4 py-2 text-ink ring-1 ring-ink/10 sm:bottom-6"
    >
      {children}
    </div>
  )
}

export function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-sm bg-ink/5" />
      ))}
    </div>
  )
}
