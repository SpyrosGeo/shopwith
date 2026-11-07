import type { InputHTMLAttributes } from 'react'

export const outlineButton =
  'inline-flex min-h-11 items-center justify-center rounded border border-white px-4 text-sm font-medium transition-colors hover:bg-white hover:text-black disabled:opacity-50'

export const primaryButton =
  'inline-flex min-h-11 items-center justify-center rounded bg-white px-4 font-medium text-black transition-opacity disabled:opacity-50'

export const card = 'rounded border border-white/10 p-4 sm:p-6'

// Required by default; pass required={false} for optional fields.
export function Field({ label, className = '', ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-white/80 ${className}`}>
      {label}
      {/* text-base (16px): iOS zooms the page when focusing inputs with smaller text */}
      <input
        required
        {...input}
        className="min-h-11 w-full rounded border border-white/20 bg-transparent px-3 text-base text-white focus:border-white focus:outline-none"
      />
    </label>
  )
}
