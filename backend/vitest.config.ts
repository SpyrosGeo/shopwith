import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolved next to this file, so tests work from any working directory.
const envFile = fileURLToPath(new URL('.env.test', import.meta.url))
if (!existsSync(envFile)) {
  throw new Error('Missing backend/.env.test — copy backend/.env.test.example')
}
process.loadEnvFile(envFile) // Node built-in; test workers inherit it

export default defineConfig({
  test: { globalSetup: './src/test-global-setup.ts' },
})
