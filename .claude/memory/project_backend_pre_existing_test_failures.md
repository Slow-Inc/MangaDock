---
name: project_backend_pre_existing_test_failures
description: Backend test/tsc baseline is clean — the old 16 books failures and 2 tsc errors are all resolved
metadata:
  type: project
---

As of 2026-06-17 (#298) the backend baseline is **clean**: `npx jest src/books` = 29 suites / 214 tests green, and `npx tsc --noEmit` = 0 errors. The historical failures this file used to track are all gone:

- **`books-pubsub-batch.spec.ts` (14 failures)** — the suite was **deleted** during the #231 decomposition; pub/sub fan-out is now covered elsewhere. No longer exists.
- **`mit-webhook-hmac.spec.ts` (2 failures)** — fixed 2026-06-05 via **#95 S2**: controller rejects unauthenticated webhooks only in production (`NODE_ENV=production`), accepts in dev; spec encodes both branches. Green.
- **2 standing tsc errors** — fixed 2026-06-17 via **#298**:
  - `cache/l3-batch-writer.spec.ts` TS2339 (`mockClear` missing) — `makeL3()` now returns `L3DiskService & { write: jest.Mock }`.
  - `common/middleware/hardware-id.middleware.spec.ts` TS2540 (read-only `path`) — `mockRequest` typed `Partial<Omit<Request,'path'>> & { path: string }`.

**Why:** keep this file as the source of truth for "is a backend failure mine or pre-existing".
**How to apply:** the baseline is green now — treat **any** `jest`/`tsc` failure as caused by your change until proven otherwise. If a new pre-existing failure appears, record it here.
