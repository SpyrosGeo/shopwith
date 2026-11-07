# Glossary

Domain terms for shopwith. Code, tickets and reviews use these names.

**List**: a named shopping list owned by one user. It holds Items.
- **Active list**: a list with at least one Item still to buy, or with no Items yet.

**Item**: one line on a List.
- It has a name, a quantity, and an optional unit price in euro cents.
- **Checked** means bought. The item's `checkedAt` holds when.

**Purchase**: the record of a checked Item, and the source of truth for spend and history.
- It is written only by `syncPurchase`, which is called only from the Lists module (`backend/src/lists.ts`).
- It survives the deletion of its Item or List.

**Product**: everything a user has bought under one product key. It is not a table; it is derived from Purchases.
- **Product key**: `productKey(name)`, the name trimmed and lowercased, so "Milk " and "milk" are the same Product.
- **Display name**: the name as it was last typed.

**UserProduct**: per-user settings for one Product, keyed by `(userId, productKey)`.
- The row is created the first time a setting is needed.
- It holds `snoozedUntil` (M3) and, later, `category` (M5). See [ADR-0001](docs/adr/0001-userproduct-holds-per-product-settings.md).

**Purchase day**: Purchases of the same Product on the same UTC day count as one Purchase day.

**Median interval**: the median gap between a Product's consecutive Purchase days, measured as exact time rather than whole days.

**Due**: whether a Product should be suggested now. A Product is due when all of these hold:
- it has at least 3 Purchase days;
- the time since its last Purchase is at least its median interval;
- it is not on any List as an unchecked Item;
- it is not snoozed.

Due Products are ranked most overdue first: time since the last Purchase divided by the median interval.

**Suggestion**: a due Product shown to the user, on the dashboard ("Running low") or as a chip in a List's add-item box. Tapping it adds an Item with the display name, quantity 1, and the last known price.

**Snooze**: dismissing a Suggestion. It hides the Product until the time of dismissal plus its median interval. A newer Purchase needs no special handling.
