import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library only auto-cleans with Vitest globals on; without this, rendered components pile up between tests.
afterEach(cleanup)
afterEach(() => vi.unstubAllGlobals())
