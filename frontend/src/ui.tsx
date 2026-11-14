import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { formatEuro } from './api.ts'

export const outlineButton =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-ink/30 px-4 text-sm font-medium transition-colors hover:bg-ink/5 disabled:opacity-50'

export const primaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-medium text-aisle transition-colors hover:bg-accent/85 active:bg-accent disabled:opacity-50'

export const dangerButton =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-alarm px-4 text-sm font-medium text-alarm transition-colors hover:bg-alarm hover:text-aisle disabled:opacity-50'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5"
    >
      {children}
    </svg>
  )
}

export function TrashIcon() {
  return (
    <Icon>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </Icon>
  )
}

const themes = {
  system: {
    label: 'System',
    icon: (
      <Icon>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </Icon>
    ),
  },
  light: {
    label: 'Light',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </Icon>
    ),
  },
  dark: {
    label: 'Dark',
    icon: (
      <Icon>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </Icon>
    ),
  },
}
type ThemeMode = keyof typeof themes
const themeOrder: ThemeMode[] = ['system', 'light', 'dark']

function storedTheme(): ThemeMode {
  try {
    const mode = localStorage.getItem('theme')
    return mode === 'light' || mode === 'dark' ? mode : 'system'
  } catch {
    return 'system' // storage blocked (private mode): fall back to the OS setting
  }
}

// Cycles System -> Light -> Dark. The script in index.html applies the stored choice before first paint.
export function ThemeToggle() {
  const [mode, setMode] = useState(storedTheme)

  useEffect(() => {
    try {
      if (mode === 'system') localStorage.removeItem('theme')
      else localStorage.setItem('theme', mode)
    } catch {
      // storage blocked: the choice lasts until reload
    }
    const prefersLight = matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const theme = mode === 'system' ? (prefersLight.matches ? 'light' : 'dark') : mode
      const root = document.documentElement
      root.dataset.theme = theme
      // Address bar matches the page background; the color lives only in index.css.
      const aisle = getComputedStyle(root).getPropertyValue('--color-aisle').trim()
      if (aisle) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', aisle)
    }
    apply()
    if (mode !== 'system') return
    prefersLight.addEventListener('change', apply) // follow live OS changes
    return () => prefersLight.removeEventListener('change', apply)
  }, [mode])

  const next = themeOrder[(themeOrder.indexOf(mode) + 1) % themeOrder.length]
  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      aria-label={`Theme: ${themes[mode].label} (switch to ${themes[next].label})`}
      title={`Theme: ${themes[mode].label}`}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
    >
      {themes[mode].icon}
    </button>
  )
}

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
      className={`inline-block bg-tag font-tag font-bold tabular-nums text-carbon ${size === 'lg' ? 'px-3 py-1 text-5xl' : 'px-1.5 text-base'}`}
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
