// Dev-only: seeds Purchase history for testing due(). Re-runnable: replaces earlier seed rows (listName 'Seed').
// Usage: npm run seed [email]   (defaults to the first user)
import { prisma } from '../src/db.js'
import { productKey } from '../src/purchases.js'

const DAY = 24 * 60 * 60 * 1000

// [name, interval in days, price cents, how far into its interval the last purchase is (≥ 1 = due)]
const products: [string, number, number, number][] = [
  ['Milk', 1, 129, 1.5],
  ['Bread', 2, 249, 0.5],
  ['Eggs', 3, 319, 1.2],
  ['Bananas', 4, 189, 0.25],
  ['Coffee', 5, 899, 2],
  ['Yogurt', 6, 159, 0.8],
  ['Toilet paper', 7, 549, 1.1],
  ['Apples', 2, 299, 3],
  ['Cheese', 3, 459, 0.3],
  ['Orange juice', 5, 279, 1],
]

const email = process.argv[2]
const user = email ? await prisma.user.findUniqueOrThrow({ where: { email } }) : await prisma.user.findFirstOrThrow()

const now = Date.now()
const rows = products.flatMap(([name, interval, priceCents, overdue]) => {
  const last = now - overdue * interval * DAY
  // 5 purchase days, one interval apart, ending at `last`
  return Array.from({ length: 5 }, (_, i) => ({
    userId: user.id,
    name: productKey(name),
    displayName: name,
    priceCents,
    listName: 'Seed',
    purchasedAt: new Date(last - (4 - i) * interval * DAY),
  }))
})
// Same-UTC-day duplicate of Milk's last purchase: must count as one purchase day
rows.push({ ...rows[4]!, purchasedAt: new Date(rows[4]!.purchasedAt.getTime() + 60_000) })

await prisma.$transaction([
  prisma.purchase.deleteMany({ where: { userId: user.id, listName: 'Seed' } }),
  prisma.purchase.createMany({ data: rows }),
])
console.log(`Seeded ${rows.length} purchases for ${user.email}`)
await prisma.$disconnect()
