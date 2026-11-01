import { test } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.tsx'

test('renders the app', () => {
  render(<App />)
  screen.getByText('test') // throws if not found
})
