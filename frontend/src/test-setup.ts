import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library only auto-cleans with Vitest globals on; without this, rendered components pile up between tests.
afterEach(cleanup)
afterEach(() => vi.unstubAllGlobals())

// jsdom has no matchMedia; ThemeToggle needs it. Reports a dark OS, the app default.
window.matchMedia = (media: string) =>
  ({ matches: false, media, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})
