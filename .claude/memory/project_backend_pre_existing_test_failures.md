---
name: project_backend_pre_existing_test_failures
description: Backend books suite has 14 pre-existing test failures (pubsub suite only) unrelated to feature work
metadata:
  type: project
---

As of 2026-06-05 (evening), `npx jest src/books` in `Backend/` reports **14 failing tests in 1 suite** that are pre-existing and NOT caused by current feature work:

- `books-pubsub-batch.spec.ts` — 14 failures (Redis pub/sub fan-out; also "worker failed to exit gracefully" → leaked timers/handles).

History: the baseline used to also include 2 failures in `mit-webhook-hmac.spec.ts` — those encoded the strict #90 S2 behavior (401 when no secret) that a 2026-06-04 session deliberately relaxed. Resolved 2026-06-05 via #95 S2: the controller now rejects unauthenticated webhooks **only in production** (`NODE_ENV=production`), accepts them in dev, and the spec encodes both branches — the hmac suite is fully green.

**Why:** ts-jest compiles `books.service.ts` for every books spec, so "does it still build" is answered by any passing books spec; the red suite is orthogonal.
**How to apply:** run the specific spec you touched; only treat a failure as yours if it's outside `books-pubsub-batch.spec.ts` or if that suite's count rises above 14.

---

**tsc errors (now FIXED 2026-06-18, #298):**

Two pre-existing `tsc --noEmit` errors in spec files — cleared on branch `fix/303-upload-magic-byte-validation`:

- `src/cache/l3-batch-writer.spec.ts` — TS2339 ×4: `mockClear` inaccessible because `makeL3()` was cast to `L3DiskService` only. Fix: `as unknown as L3DiskService & { write: jest.Mock }`.
- `src/common/middleware/hardware-id.middleware.spec.ts` — TS2540 ×6: `mockRequest.path` read-only (Express types declare `path` as getter). Fix: `let mockRequest: Omit<Partial<Request>, 'path'> & { path?: string }`.

`npx tsc --noEmit` now exits 0 on this branch. The 14 books-pubsub-batch failures remain (unrelated).

---

**Update 2026-06-18 (#294):** a full `npx jest` on `Backend/` reported **64 suites / 595 tests, 0 fail** (and `npx jest src/books` 244/0). The `books-pubsub-batch` failures are therefore **environment-dependent on a running Redis**, not unconditional — when Redis is up locally the suite is fully green. Treat the count as a baseline to diff against, but do not assume 14 reds when the machine has Redis. Verified clean baseline before the #294 transport/job-state split.
