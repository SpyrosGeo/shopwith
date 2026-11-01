import { test, expect } from 'vitest'
import { buildApp } from './app.js'

test('GET / returns hello world', async () => {
  const app = buildApp()
  const res = await app.inject({ method: 'GET', url: '/' })

  expect(res.statusCode).toBe(200)
  expect(res.body).toBe('hello world')
})
