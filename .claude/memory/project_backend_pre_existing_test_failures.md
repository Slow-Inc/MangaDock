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
