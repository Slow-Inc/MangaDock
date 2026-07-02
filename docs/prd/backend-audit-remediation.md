# PRD: Backend Audit Remediation

**Status:** Draft
**Author:** akkanop-x (from full-Backend audit, 2026-06-28)
**Date:** 2026-06-28

---

## Overview

A full read-only audit of `Backend/` (90 source files, ~12k LOC) surfaced 31 concrete defects across logic correctness, algorithmic efficiency, and runtime performance. The most severe can cause **lost customer payments** (coins never credited after a paid top-up), **system-wide latency** (a network round-trip to Supabase Auth on every request, no caching), and **event-loop blocking** (synchronous `fs` calls on hot paths). This PRD defines the remediation scope: which defects we fix, in what order, and what "fixed" means — so the work can be broken into tracked, independently-mergeable issues.

This is a hardening effort on existing code, not a new feature. It follows the project's Engineering North Star: prefer the simplest fix that removes the defect over adding layers to prop it up. Every fix is surgical and must ship with a regression test where the defect is testable in isolation.

---

## Goals

- **Eliminate money-correctness defects** — zero paths where a user can pay and not receive coins, or be charged a stale/incorrect price.
- **Remove per-request network/IO from hot paths** — auth token validation and asset serving must not add an unbounded network or blocking-IO cost to every request.
- **Stop event-loop blocking** — no synchronous `fs.*Sync` calls on request or timer-driven code paths.
- **Fix silent data-loss / data-drift** — cached translation pages reach all readers; failed cache-sync keys get retried; L3 disk entries don't collide or corrupt.
- **Close abuse/cost vectors** — unauthenticated, paid-API-backed endpoints are rate-limited.
- Every HIGH/MEDIUM fix lands with a test proving the defect is gone (where unit-testable) and does not regress existing `npm test` / `npm run test:e2e`.

## Non-goals

- No new product features, endpoints, or schema beyond what a fix strictly requires (e.g. a unique constraint for vote upsert is in scope; a new "controversial" sort is not).
- No broad refactor of modules beyond the touched defect (North Star: surgical changes only).
- No changes outside `Backend/` (Frontend/MIT untouched).
- No rewrite of the multi-layer cache architecture — only the specific defects listed.
- LOW-severity items are documented but not committed to a delivery date; they are a backlog tier.

---

## User Stories

1. As a **paying user**, I want my coins credited reliably after a successful PromptPay top-up, so that I never pay and lose the coins even if a downstream step fails or Xendit retries the webhook.
2. As a **paying user**, I want to be charged exactly the chapter's current published price at the moment of purchase, so that a concurrent price change or unpublish cannot make me overpay or buy an unavailable chapter.
3. As **any user**, I want API responses to be fast under load, so that pages firing many parallel calls don't each incur a separate Supabase Auth round-trip and hit rate limits.
4. As a **reader**, I want image/asset requests (`/uploads/**`) and uploads to not stall the server, so that one large file doesn't block every other in-flight request.
5. As a **second concurrent reader** of a chapter being translated, I want to receive the already-cached translated pages, so that I don't silently miss pages another reader's job had cached.
6. As an **operator**, I want a cancelled translation job to actually stop hitting the MIT GPU, so that abandoned reads don't burn compute.
7. As an **operator**, I want cache-sync failures to retry automatically, so that Supabase doesn't silently drift out of sync until the next leader election.
8. As a **forum user**, I want double-clicking a vote to not create duplicate/ghost votes, so that counts stay correct.
9. As the **business**, I want unauthenticated, paid-API-backed endpoints (e.g. email validation) rate-limited, so that they can't be abused to run up cost.
10. As an **operator**, I want top-up SSE subjects cleaned up when a top-up expires unpaid, so that the process doesn't leak memory over time.

---

## Functional Requirements

Each FR maps to one defect (file:line from the audit) and becomes one issue. Severity tiers drive ordering.

### Tier 1 — HIGH: Money correctness

- **FR-1** (`wallet.service.ts:365-409`): The webhook claim (`status:'paid'`) and `addCoins` credit must be atomic or compensating. If `addCoins` (or `getPaymentRequest`) throws after the claim commits, the claim must be reverted (`revertClaim`) so a Xendit retry re-processes it — or claim+credit must be a single idempotent RPC keyed by `payment_id`. Outcome: no state where `status='paid'` exists without a corresponding credit.
- **FR-2** (`unlock.service.ts:68-98`): `purchase_unlock_atomic` must re-read `price_coins` and `status='published'` inside the transaction; the caller must not pass `p_price`. Outcome: the debited amount always equals the price at commit time, and unpublished chapters cannot be purchased.

### Tier 2 — HIGH: System-wide performance

- **FR-3** (`auth.guard.ts:26`, `optional-auth.guard.ts:15`, `supabase.service.ts:33`): Replace the per-request `auth.getUser()` network call with local JWT verification (Supabase JWKS/secret) or a short-TTL (30–60s) cache keyed by a token hash. Outcome: N parallel authenticated calls cause at most one (cached) validation, not N round-trips.
- **FR-4** (`disk-storage.provider.ts:40-71`, `upload.service.ts:74`, `uploads.controller.ts:34`, `l3-disk.service.ts:98`): Replace all `fs.*Sync` on request/timer paths with `fs/promises`; stream asset serving and uploads instead of buffering whole files. Outcome: no synchronous fs on hot paths; assets served via stream.
- **FR-5** (`json-cache.service.ts:56`): `getAll()` must not deep-copy the entire L1 map (up to 10k entries) on each call; expose a filtered iterator / iterate `entries()` directly. Outcome: batch-writer timers no longer copy the whole cache several times per second.
- **FR-6** (`versions.service.ts:104`): Skip the per-row `storage.list()` availability check for the R2 provider (or make it lazy/cached). Outcome: listing a title with M chapters no longer triggers M network calls per request.

### Tier 3 — HIGH: Logic / data loss

- **FR-7** (`mit-batch-stream.ts:358-369`): Thread the real `run()` `signal` into both `_retryMissingPagesIndividually` calls so abort actually stops the retry loop. Outcome: a cancelled job stops calling MIT.
- **FR-8** (`mit-batch-orchestrator.service.ts:442-450`): Record cached pages in `job.completedPages` (and keep `expectedCount` aligned) so a second reader attaching to the same `jobKey` receives them. Outcome: latecomers get all cached pages.
- **FR-9** (`forum.service.ts:681-711`): Make `vote()` atomic — `upsert` on a `(uid,target_type,target_id)` unique constraint (add the constraint if missing) or move the toggle into the atomic RPC. Outcome: concurrent votes cannot create duplicates/ghosts.
- **FR-10** (`forum.service.ts:115,155`): Use `p.comments?.[0]?.count ?? 0` in `listPosts` and `getPost`. Outcome: a null comments embed does not throw.
- **FR-11** (`batch-sync.worker.ts:148-153`): On non-fatal sync failure, move the key from PROCESSING back to DIRTY (or run `recoverOrphans` each flush). Outcome: failed keys retry without waiting for a leadership change.

### Tier 4 — MEDIUM

- **FR-12** (`wallet-events.service.ts:8-25`): Complete and delete the per-topup `Subject` on stream teardown / timer expiry. Outcome: no unbounded Map growth.
- **FR-13** (`wallet-events.service.ts:6`, `wallet.service.ts:412`): Publish wallet events over Redis pub/sub (like `ForumEventsService`) so SSE works across instances (3001/4001).
- **FR-14** (`redis.service.ts:102`): Replace `KEYS` with a `SCAN` cursor loop.
- **FR-15** (`cache-orchestrator.service.ts:78-81`): When `ttlRemainingMs <= 0`, skip the L1 write (don't let near-expiry entries become immortal). Optionally add single-flight coalescing on miss (cache stampede) — tracked as a sub-item.
- **FR-16** (`forum.service.ts:584-621`): Compute trending via a Postgres `group by … order by count desc limit n` (RPC/view) instead of an unordered `.limit(200)` JS tally.
- **FR-17** (`forum.service.ts:79,220,253`): Exclude `deleted_at` rows from embedded comment counts.
- **FR-18** (`landing.service.ts:255-259`): Fetch the 4 landing rows with `Promise.all` instead of sequential `for await`.
- **FR-19** (`mangadex.service.ts:319,194,666`, `image-cache.service.ts:95-117`): Bound/throttle the per-cover/per-page `exists` re-check on cache hits (batch via one `storage.list(dir)` and diff).
- **FR-20** (`mit-batch-stream.ts:396-417`): Run missing-page recovery with bounded concurrency (pool of 3–4) instead of serial `for await`.
- **FR-21** (`users.service.ts:143-180,215-238,499-520`): `upsertUser` → atomic upsert on conflict `uid`; `getProfile` → `Promise.all`; `deleteUserAccount` → parallelize independent deletes.
- **FR-22** (`cloudflare-r2.provider.ts:25-53`): Stream PUT/GET bodies instead of double-buffering.

### Tier 5 — LOW (backlog, no committed date)

- **FR-23** (`uploads.controller.ts:30`): Assert resolved path stays within `uploads/` root (path traversal).
- **FR-24** (`users.service.ts:443`): Prefix CSV fields starting with `= + - @` (CSV injection).
- **FR-25** (`topup-throttle.guard.ts:29`): Make `incr`+`expire` atomic (`SET … EX NX` / Lua).
- **FR-26** (`mit-config.ts:99`): Memoize `renderConfigHash` (pure over env).
- **FR-27** (`wallet.service.ts:394`): Assert `currency === 'THB'`; decouple coin amount from THB amount.
- **FR-28** (`cache-orchestrator.service.ts:114`): Downgrade per-`set()` log to `debug`.
- **FR-29** (`patch-store.ts:88-97`): `Promise.all` region PNG writes.
- **FR-30** (`stats-increment.service.ts:55-59`): Fix `secondsUntilEndOfDay` clamp (`Math.max(remaining, 60)` not full day).
- **FR-31** (`l3-disk.service.ts:48,98`): Hash/encode filename to avoid key collisions; write `*.tmp` then rename for atomicity.

---

## Non-functional Requirements

- **Performance:** Authenticated request path adds ≤1 token validation per token per TTL window (not per request). No `fs.*Sync` on request/timer paths. Landing/detail/reader cache-hit paths do not scale fs `stat` calls with page/cover count.
- **Security/correctness:** Money paths (FR-1, FR-2) must be atomic or compensating and idempotent under webhook retry. No regression to the existing, already-correct HMAC + constant-time webhook verification.
- **Reliability:** Cache-sync failures self-heal without operator action. L3 disk writes are crash-safe (atomic rename) and collision-free.
- **Error handling:** Compensating actions (revertClaim, requeue) must log with the relevant id (`payment_id`, cache key) for reconciliation.
- **Testing:** Each fix ships a regression test where unit-testable (the project already isolates such logic, e.g. `translation-cache-reset.ts`). Money fixes get tests asserting no-credit-without-claim and no-stale-price.

---

## UX / UI Notes

Backend-only; no UI surface changes. Observable behavior changes:

- **Happy path:** unchanged — users see the same flows, faster under load.
- **Payment failure mid-credit:** previously silent coin loss → now the top-up either fully completes on retry or remains `pending` for retry; user eventually receives coins.
- **Concurrent translation read:** second reader now receives cached pages instead of hanging to the 15-min timeout.
- **Vote double-click:** count stays correct instead of producing ghost votes.

---

## Technical Notes

- **Atomicity lives in Postgres RPCs.** FR-1/FR-2/FR-9 partly depend on Supabase RPCs (`add_coins_atomic`, `spend_coins_atomic`, `purchase_unlock_atomic`, `recalculate_votes_atomic`). Where the fix requires the RPC to re-read price/status or accept an idempotency key, apply schema/function changes via Supabase MCP `apply_migration` (per CLAUDE.md), not the reference `supabase-migration.sql`.
- **Vote upsert (FR-9)** needs a unique constraint on `forum_votes(uid, target_type, target_id)` if not already present — verify via `list_tables` before adding.
- **Auth caching (FR-3)** — prefer local JWT signature verification over a cache if the Supabase JWT secret/JWKS is available, since it removes the network dependency entirely (simplest-that-works). Fall back to a short-TTL token-hash cache otherwise.
- **Redis pub/sub for wallet (FR-13)** should reuse the existing `ForumEventsService` Redis channel pattern rather than introduce a new mechanism.
- **Streaming (FR-4, FR-22)** — `StorageProvider` already accepts `Readable`; pass `fs.createReadStream` through instead of buffering.
- Work happens in worktree branch `worktree-backend-audit-fixes`. Tiers are independently mergeable; money tier (FR-1/FR-2) should merge first behind review.

---

## Success Metrics

- **Zero** occurrences of `status='paid'` rows without a matching coin credit (reconciliation query returns empty) after FR-1.
- **Auth round-trips per request → ~0** under a burst of N parallel authenticated calls (was N) after FR-3.
- **No `fs.*Sync`** remaining in request/timer code paths (grep-verifiable) after FR-4/FR-6.
- Second concurrent reader of an in-flight translation receives 100% of cached pages (was 0%) after FR-8.
- All existing `npm test` + `npm run test:e2e` green; new regression tests added for FR-1, FR-2, FR-8, FR-9, FR-11.

---

## Open Questions

- [ ] Is the Supabase JWT secret/JWKS available to the backend for local verification (FR-3), or must we use a token-hash cache?
- [ ] Does `forum_votes` already have a unique constraint on `(uid, target_type, target_id)` (FR-9)?
- [ ] For FR-1, do we prefer compensating `revertClaim` or a new single idempotent claim+credit RPC? (revertClaim helper already exists per recent commit `e673db0`.)
- [ ] Are the existing money RPCs individually atomic as assumed, or do they also need hardening?
- [ ] Confirm Tier 5 (LOW) is backlog-only and not part of this delivery.
