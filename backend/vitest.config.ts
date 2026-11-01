import { defineConfig } from 'vitest/config'

process.loadEnvFile('.env.test') // Node built-in; test workers inherit it

export default defineConfig({
  test: { globalSetup: './src/test-global-setup.ts' },
})
