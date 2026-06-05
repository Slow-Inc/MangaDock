---
name: project_backend_pre_existing_test_failures
description: Backend books suite has 16 pre-existing test failures unrelated to feature work
metadata:
  type: project
---

As of 2026-06-05, `npx jest src/books` in `Backend/` reports **16 failing tests in 2 suites** that are pre-existing and NOT caused by current feature work:

- `books-pubsub-batch.spec.ts` — 14 failures (Redis pub/sub fan-out; also "worker failed to exit gracefully" → leaked timers/handles).
- `mit-webhook-hmac.spec.ts` — 2 failures.

Verified by `git stash` of the working change and re-running: the same 16 fail on pristine `HEAD`. When validating a Backend change, compare against this baseline — do **not** chase these as regressions. Newly-added specs this session (`books-batch-cancel.spec.ts`, `books-mit-config.spec.ts`) pass clean.

**Why:** ts-jest compiles `books.service.ts` for every books spec, so "does it still build" is answered by any passing books spec; the red suites are orthogonal.
**How to apply:** run the specific spec you touched; only treat a failure as yours if it's outside these two suites or if the count in these two suites rises above 14/2.
