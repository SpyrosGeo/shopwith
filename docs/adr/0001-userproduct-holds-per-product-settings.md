# ADR-0001: UserProduct holds per-user, per-product settings

- Status: accepted
- Date: 2026-11-07

## Context
Milestone 3 needs to store a snooze per product: hide a Suggestion until a given time. Milestone 5 needs to store a category per product. In both cases the product is identified by `productKey(name)` and the data belongs to one user. Products themselves are not a table; they are derived from Purchase rows.

We considered three places to keep snoozes:
1. A table just for snoozes, `ProductSnooze(userId, name, until)`.
2. A general `UserProduct(userId, name)` table that holds `snoozedUntil`.
3. The browser's local storage.

## Decision
Create `UserProduct` in M3, with a unique key on `(userId, name)`:
- `name` is the product key.
- `snoozedUntil` is a nullable DateTime.
- M5 adds `category` to the same row.

A row is created the first time a setting is needed. A Product with no row has the defaults: not snoozed, category "Other".

## Consequences
- There is one place for a user's per-product settings. M5 adds a column to an existing table instead of creating a new one.
- `UserProduct` is joined at query time by product key, so changing a setting also applies to past Purchases.
- We rejected local storage: a snooze set on one device would not reach the user's other devices.
