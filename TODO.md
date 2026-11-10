# TODO

shopwith shops with you: it tracks your buying habits, suggests what's missing, shows data about
your purchases and tracks spending. Single user (no shared lists), mobile-first, online-only.

## Ground rules
- `Purchase` is the source of truth for spend, habits, suggestions, insights and export.
  It is written only by `syncPurchase` (`backend/src/purchases.ts`), and survives deleting its item or list.
- Products are identified by `productKey(name)` (lowercased + trimmed). No product catalog or aliases.
- Money is EUR, stored as integer cents. Months are UTC calendar months.
- Each milestone ships usable on its own, in this order.

## Milestones

### 1. Purchase as source of truth
- [x] `Purchase` gets `itemId` (unique, set null on item delete), `quantity`, `priceCents`, `listName` snapshot
- [x] `syncPurchase` keeps the row in step with every item edit; unchecking deletes it
- [x] Dashboard monthly spend reads from `Purchase`
- [x] No backfill of old `Purchase` rows (dev data only)

### 2. List UI
- [x] Lists index page: create (opens the new list); rename and delete live on the list page
- [x] List detail page: add, check off (one tap, optimistic), edit inline, delete items
- [x] Optional price on add/edit, pre-filled with the last price paid for that name
- [x] Checked items without a price show an "Add price" affordance
- [x] Autocomplete item names from past purchases (`GET /api/products`, `Purchase.displayName`)
- [x] Dashboard active-list cards link to the list page
- [x] Navigation: bottom tab bar on mobile, top nav from `sm:` — Home, Lists (Insights and Settings get added in M4/M6)

### 3. Suggestions ("running low")
Terms (Due, Purchase day, Median interval, Snooze, UserProduct): see `GLOSSARY.md`. Storage: `docs/adr/0001-userproduct-holds-per-product-settings.md`.
- [ ] `due(userId, now)` in `backend/src/purchases.ts`: ≥3 Purchase days (same UTC day = one), due when
      time since last ≥ median interval, not on any list as an unchecked item, not snoozed;
      most overdue first; returns display name, median interval, last price
- [ ] `UserProduct (userId, name, snoozedUntil)` table, unique `(userId, name)`, row created on first use
- [ ] `GET /api/suggestions` (ranked due Products) and `POST /api/suggestions/snooze { name }`
      (snoozedUntil = now + median interval)
- [ ] `POST /api/suggestions/add { name }`: adds display name, qty 1, last price to the newest active list,
      creating a "Shopping" list if none; rule lives in `backend/src/lists.ts`
- [ ] Dashboard "Running low" section (max 8, hidden when empty): tap adds, × snoozes
- [ ] Suggestion chips in a list's add-item box (max 5): tap adds to that list via the add-item endpoint
      (pre-filled), × snoozes

### 4. Insights
- [ ] Top items by count and by spend
- [ ] Per-item history page: purchase dates, price over time, average interval, last price

### 5. Categories
- [ ] Fixed presets: Produce, Dairy, Meat & Fish, Bakery, Pantry, Frozen, Drinks, Household, Personal care, Other
- [ ] `UserProduct (userId, name, category)` keyed by `productKey`; joined at query time,
      so recategorizing fixes history too. New names default to Other
- [ ] Category chip on each item; tap to pick, remembered for that name
- [ ] List page groups unchecked items by category; bought items collapse at the bottom
- [ ] Spend by category in Insights

### 6. Budget
- [ ] One monthly total, set in Settings
- [ ] Dashboard progress bar: amber at 80%, red when over
- [ ] "€X left this month" on list pages when a budget is set

### 7. CSV export
- [ ] From Settings, one row per purchase, for a chosen month or all time
- [ ] Columns: date, item name, category, quantity, unit price, line total, list name

## Later / not planned yet
- Shared lists, user-defined categories, per-category budgets, "never suggest",
  name aliases/merging, per-user timezone for month boundaries

## PWA
- [x] Installable: `vite-plugin-pwa` manifest, icons generated from `public/favicon.svg`, SW precaches the app shell (`autoUpdate`)
- [x] iOS meta tags (apple-touch-icon, standalone, status bar)
- [ ] Real app icon (current `favicon.svg` is a placeholder); regenerate with `npx pwa-assets-generator --preset minimal-2023 public/favicon.svg`
- [ ] Offline read: cache lists/items for no-signal use; clear the cache on logout (`/api` is cookie-authed, per user)
- Not planned: offline writes (needs a mutation queue and conflict handling with purchase sync)

## Deployment
- [ ] Frontend hosting must serve `sw.js` and `manifest.webmanifest` with `Cache-Control: no-cache`, or users get stuck on old versions
- [ ] Postgres backups for prod (nightly `pg_dump` cron or Proxmox VM backup); the `pgdata` volume is the only copy

## Auth (no hard deadline; pick up as features need them)
- [ ] Rate-limit `POST /api/auth/login` with `@fastify/rate-limit` before any public deploy (password guessing is unlimited now)
- [ ] Password reset
- [ ] Email verification on register
- [ ] Delete expired sessions (rows stay in `Session` after `expiresAt`)
