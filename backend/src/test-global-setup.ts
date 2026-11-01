import { execSync } from 'node:child_process'

// Runs once before all tests: wipe and re-migrate the test database.
export default function setup() {
  const url = process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL is not set (expected from backend/.env.test)')

  // The reset deletes all data, so refuse anything that isn't the test database.
  const dbName = new URL(url).pathname
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to reset non-test database: ${dbName}`)
  }
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' })
}
