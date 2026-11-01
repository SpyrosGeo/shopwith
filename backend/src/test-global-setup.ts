import { execSync } from 'node:child_process'

// Runs once before all tests: wipe and re-migrate the test database.
export default function setup() {
  const url = process.env['DATABASE_URL'] ?? ''
  // The reset deletes all data, so refuse anything that isn't the test database.
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error(`Refusing to reset non-test database: ${new URL(url).pathname}`)
  }
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' })
}
