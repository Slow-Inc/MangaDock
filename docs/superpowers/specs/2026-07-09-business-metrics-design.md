# Business Metrics Design

**Date:** 2026-07-09
**Scope:** Backend only (NestJS)
**Goal:** Add 4 Prometheus counters tracking chapter reads, chapter unlocks, and coin flow — exposed on the existing `GET /metrics` endpoint alongside HTTP metrics.

---

## Metrics Catalogue

| Name | Type | Increment point | Value added |
|------|------|----------------|-------------|
| `mangadock_chapter_reads_total` | Counter | `BooksService.getMangaChapterPages()` — after successful page fetch | +1 per request |
| `mangadock_chapter_unlocks_total` | Counter | `UnlockService.purchaseUnlock()` — after `purchase_unlock_atomic` RPC succeeds and `already_unlocked` is false | +1 per new unlock |
| `mangadock_coins_spent_total` | Counter | `UnlockService.purchaseUnlock()` (uses `row.price_paid`) AND `WalletService.spendCoins()` (uses `amount`) | +coins per call |
| `mangadock_coins_added_total` | Counter | `WalletService.addCoins()` — after `add_coins_atomic` RPC succeeds | +coins per call |

No labels (global counters only — avoids high-cardinality manga_id/user_id breakdowns).

---

## Architecture

```
MetricsModule
  ├── MetricsController        (GET /metrics — unchanged)
  ├── MetricsMiddleware        (HTTP instrumentation — unchanged)
  ├── metrics.service.ts       (HTTP counters/histograms — unchanged)
  └── business-metrics.service.ts  ← NEW: 4 counter methods

BooksModule   imports MetricsModule → BooksService   injects BusinessMetricsService
UnlockModule  imports MetricsModule → UnlockService  injects BusinessMetricsService
WalletModule  imports MetricsModule → WalletService  injects BusinessMetricsService
```

`MetricsModule` adds `BusinessMetricsService` to `providers` and `exports` — the 3 domain modules import it like any other shared module.

---

## `BusinessMetricsService` Interface

```ts
@Injectable()
export class BusinessMetricsService {
  recordRead(): void                          // +1 chapter_reads_total
  recordUnlock(pricePaid: number): void       // +1 chapter_unlocks_total; +pricePaid coins_spent_total
  recordCoinsSpent(amount: number): void      // +amount coins_spent_total
  recordCoinsAdded(amount: number): void      // +amount coins_added_total
}
```

Internally each method calls `.inc()` on its `prom-client` `Counter` instance. The counters are registered on the default `register` (same one `metrics.service.ts` uses) so they appear automatically in `GET /metrics`.

---

## Instrumentation Points

### `BooksService.getMangaChapterPages(chapterId, …)`
Call `this.biz.recordRead()` immediately after the page array is returned successfully (before the `return`). No-op on error paths.

### `UnlockService.purchaseUnlock(uid, versionId)`
After `purchase_unlock_atomic` RPC returns without error:
- If `row.already_unlocked` is `true` → skip (don't count re-checks)
- Else → `this.biz.recordUnlock(row.price_paid ?? 0)`

`recordUnlock` internally increments both `chapter_unlocks_total` (+1) and `coins_spent_total` (+pricePaid). This is correct: the atomic RPC deducts coins directly in the DB; `WalletService.spendCoins()` is a separate code path not called for unlocks.

### `WalletService.addCoins(uid, amount, type, …)`
Call `this.biz.recordCoinsAdded(amount)` after `add_coins_atomic` RPC succeeds (before `return`).

### `WalletService.spendCoins(uid, amount, …)`
Call `this.biz.recordCoinsSpent(amount)` after `spend_coins_atomic` RPC succeeds (before `return`).

---

## Files Changed

| File | Change |
|------|--------|
| `Backend/src/metrics/business-metrics.service.ts` | **NEW** — 4 counters + methods |
| `Backend/src/metrics/business-metrics.service.spec.ts` | **NEW** — unit tests (spy on Counter.inc) |
| `Backend/src/metrics/metrics.module.ts` | Add `BusinessMetricsService` to `providers` + `exports` |
| `Backend/src/books/books.module.ts` | Add `MetricsModule` to `imports` |
| `Backend/src/books/books.service.ts` | Inject `BusinessMetricsService`; call `recordRead()` |
| `Backend/src/unlock/unlock.module.ts` | Add `MetricsModule` to `imports` |
| `Backend/src/unlock/unlock.service.ts` | Inject `BusinessMetricsService`; call `recordUnlock()` |
| `Backend/src/wallet/wallet.module.ts` | Add `MetricsModule` to `imports` |
| `Backend/src/wallet/wallet.service.ts` | Inject `BusinessMetricsService`; call `recordCoinsAdded/Spent()` |

Total: 2 new files, 7 surgical edits (1–4 lines each).

---

## Testing

`business-metrics.service.spec.ts` — unit tests only (no DB/network):
- `recordRead()` calls `chapterReadsTotal.inc(1)`
- `recordUnlock(5)` calls `chapterUnlocksTotal.inc(1)` and `coinsSpentTotal.inc(5)`
- `recordCoinsSpent(10)` calls `coinsSpentTotal.inc(10)`
- `recordCoinsAdded(100)` calls `coinsAddedTotal.inc(100)`

Integration verification: after adding instrumentation, call each endpoint once and `curl /metrics` — confirm the 4 counter names appear with value > 0.

---

## Non-Goals

- No manga_id / user_id labels (global counters only)
- No Gauge for total coins in circulation (requires periodic DB query — out of scope)
- No reads on `GET /books/manga/:id` (detail view) — only chapter page fetch counts as a read
- No changes to MIT, Frontend, dashboardv2
