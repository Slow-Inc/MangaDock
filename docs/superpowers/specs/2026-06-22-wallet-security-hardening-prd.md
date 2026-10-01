## Problem Statement

Coins are real money (1 coin = 1 THB). Today a user can obtain coins they never paid for, and a chapter purchase can take a user's coins without the creator ever being paid.

From the people who use MangaDock:

- **As a paying reader**, I trust that my coin balance reflects money I actually spent, and that unlocking a chapter either fully completes (I lose coins, I get the chapter, the creator gets their share) or fully fails (nothing moves) — never a half-state where my balance drops but I get nothing.
- **As a creator/translator**, I trust that every paid unlock of my chapter credits my share, atomically, at the moment the buyer is charged.
- **As the platform operator**, I need it to be impossible for anyone to mint coins without a settled PromptPay payment — whether by forging the Xendit webhook, replaying it, exploiting a dev/test endpoint that leaked into production, or sending a mismatched amount.

The audit found nine concrete gaps (referred to below as V1–V9). The most severe (V1): the coin-crediting webhook trusts its own request payload — HMAC verification is optional, there is no call back to Xendit to confirm the payment really succeeded, and the credited amount is never reconciled against what was actually settled. An attacker who creates their own pending topup and posts a forged `payment.succeeded` can credit themselves unlimited coins for free.

## Solution

Turn coin creation into a verified-payment-only operation and make every coin movement atomic, without changing the authorization model established in ADR 013 (one service-role Supabase client, ownership enforced in code).

From the user's perspective nothing visibly changes on the happy path — topup QR, scan, pay, balance updates exactly once; unlock charges once and grants access. What changes is what becomes *impossible*:

1. **Verified-payment coin minting.** The Xendit webhook now authenticates (static token compared in constant time + mandatory HMAC in production), then — before crediting — re-fetches the authoritative payment state directly from Xendit's API and reconciles the settled amount against the topup record. A forged, replayed, or amount-mismatched webhook credits nothing.
2. **Boot fail-closed.** In production the app refuses to start unless both the webhook token and HMAC secret are configured (mirrors the existing Turnstile boot assertion and ADR 013's follow-up recommendation).
3. **Dev/test mint endpoints are opt-in only.** The simulate and direct-topup endpoints are gated behind a positive `XENDIT_ALLOW_SIMULATE` flag that defaults to off, instead of relying on the absence of `NODE_ENV=production`.
4. **Bounded amounts.** Topup amounts are validated as integers within `[20, 100000]`, bounding the `INTEGER` balance column against overflow and abuse.
5. **Atomic unlock.** Unlock purchase becomes a single Postgres transaction that inserts the unlock row, debits the buyer, and credits the creator's share together — no partial state.
6. **Ledger idempotency + rate limiting.** A topup-scoped uniqueness guarantee on the transaction ledger backstops double-credit, and topup creation is rate-limited per user.

## User Stories

1. As a paying reader, I want my coin balance to only ever increase after a PromptPay payment that Xendit confirms as settled, so that my balance always reflects real money.
2. As a paying reader, I want the amount credited to exactly equal the amount I paid, so that I am never short-changed or over-credited.
3. As a paying reader, I want a topup to credit my account exactly once even if the payment provider sends the success notification multiple times, so that I am not confused by phantom balances.
4. As a paying reader, I want unlocking a paid chapter to be all-or-nothing, so that I never lose coins without receiving the chapter.
5. As a paying reader, I want to be told clearly when I have insufficient balance, so that I can top up instead of silently failing.
6. As a paying reader, I want a chapter I already unlocked to not charge me again if I click unlock twice, so that I am never double-charged.
7. As a creator/translator, I want my revenue share credited in the same transaction that charges the buyer, so that I am never left unpaid after a buyer is debited.
8. As a creator/translator, I want my earnings totals to stay consistent with the wallet ledger, so that what I see owed matches what was actually moved.
9. As the platform operator, I want forged `payment.succeeded` webhooks to credit nothing, so that coins cannot be minted without payment.
10. As the platform operator, I want the webhook to verify each payment against Xendit's API before crediting, so that a leaked static token alone cannot mint coins.
11. As the platform operator, I want webhook HMAC verification to be mandatory in production, so that an unsigned or wrongly-signed callback is rejected.
12. As the platform operator, I want the app to refuse to boot in production if the webhook token or HMAC secret is missing, so that a misconfigured deploy fails loudly instead of silently accepting forgeries.
13. As the platform operator, I want the static webhook token compared in constant time, so that it cannot be recovered via a timing side-channel.
14. As the platform operator, I want the simulate-payment endpoint blocked unless an explicit opt-in flag is set, so that a misconfigured `NODE_ENV` in production cannot expose free coins.
15. As the platform operator, I want the direct dev-topup endpoint blocked unless the same explicit opt-in flag is set, so that it cannot mint coins in production.
16. As the platform operator, I want topup amounts bounded to a sane integer range, so that a single mutation cannot overflow the balance column or request an absurd amount.
17. As the platform operator, I want a given Xendit payment to be creditable as a topup at most once at the ledger level, so that any future code path that bypasses the status-claim still cannot double-credit.
18. As the platform operator, I want topup creation rate-limited per user, so that the live Xendit API cannot be hammered to amplify cost or exhaust resources.
19. As the platform operator, I want a webhook that cannot be verified (Xendit unreachable) to delay crediting and let the provider retry, rather than crediting unverified, so that an outage never fabricates coins.
20. As the platform operator, I want only published chapter versions to be purchasable, so that drafts or rejected versions cannot be unlocked or trigger a payout.
21. As the platform operator, I want every security-relevant rejection (amount mismatch, failed verification) logged with the payment id and amounts, so that abuse attempts are auditable.
22. As an attacker who creates a pending topup and posts a forged success webhook, I want to receive nothing, so that the exploit is closed.
23. As an attacker who replays a captured legitimate webhook, I want no additional credit, so that replay is neutralized.
24. As an attacker who submits a webhook for an amount different from what was charged, I want the credit refused and the claim reverted, so that amount tampering fails.
25. As a developer, I want the webhook config resolution to be a pure, dependency-light function, so that the fail-closed matrix is unit-testable in isolation like the Turnstile config.
26. As a developer, I want the atomic unlock logic to live in one Postgres function, so that correctness does not depend on TypeScript orchestration ordering across two RPC calls.
27. As a developer, I want the dead/broken `numeric` overloads of the coin RPCs removed, so that overload resolution cannot accidentally select a function that fails to write the ledger.
28. As a developer, I want new behavior covered at the highest existing test seam, so that tests assert external behavior and survive refactors.
29. As the platform operator, I want a documented pre-deploy checklist for the new environment variables, so that production is configured fail-closed before launch.

## Implementation Decisions

Respects **ADR 013** — the service-role Supabase client and authorization-in-code model are unchanged. This work hardens the correctness of money mutations and the trust boundary of the payment webhook; it does not introduce RLS policies (that remains an open ADR-013 follow-up, explicitly out of scope here).

**Webhook trust boundary (V1, V2, V8)**
- The `processXenditWebhook` flow becomes: authenticate → atomically claim the topup (`pending → paid`) → actively verify against Xendit → reconcile amount → credit. The atomic status-claim remains the concurrency gate against double-credit; active verification is layered on top.
- Static `x-callback-token` is compared in constant time (hash both sides, `timingSafeEqual`).
- HMAC-SHA256 over the raw request body is **mandatory in production**; outside production it is enforced whenever a secret is configured.
- A new `XenditService.getPaymentRequest(paymentRequestId)` reads the authoritative payment state from Xendit (`GET /payment_requests/:id`, `api-version: 2024-11-11`) and returns `{ status, amount, currency }`.
- After the claim, the webhook credits only if Xendit reports `status === 'SUCCEEDED'` **and** the settled amount equals the topup's `amount_coins` (1 coin = 1 THB invariant). On any mismatch or fetch failure the claim is reverted to `pending` (so a genuine later retry can re-process) and no coins are credited. Supabase remains the long-term authoritative store; Xendit is the authority for whether a payment settled.

**Boot fail-closed (V1, V12)**
- A new pure resolver `resolveXenditWebhookConfig(env, logger?)` mirrors `resolveTurnstileConfig`: in production it throws unless both `XENDIT_WEBHOOK_TOKEN` and `XENDIT_WEBHOOK_SECRET` are set. It is invoked at boot in the application bootstrap, alongside the existing Turnstile assertion.

**Dev/test mint endpoints (V3, V4)**
- The simulate endpoint and the direct dev-topup endpoint are gated by `process.env.XENDIT_ALLOW_SIMULATE === 'true'` (fail-closed default). The previous `NODE_ENV === 'production'` negative checks are removed.
- The direct dev-topup endpoint validates its body through the existing topup DTO.

**Amount bounds (V4, V5)**
- A shared constant `MAX_TOPUP_COINS = 100000`. The topup DTO enforces `@IsInt @Min(20) @Max(MAX_TOPUP_COINS)`. The `addCoins`/`spendCoins` service guards reject non-integer, non-positive, or over-max amounts as a defense-in-depth layer below the DTO.

**Atomic unlock (V6, V7)**
- A new `SECURITY DEFINER` Postgres function `purchase_unlock_atomic(p_uid, p_version_id, p_price, p_creator_uid, p_platform_pct, p_description)` performs, in one transaction: idempotent unlock insert (PK `uid, version_id`; conflict ⇒ already unlocked, no charge), atomic buyer debit (insufficient funds ⇒ raise, rolling back the whole transaction), and creator credit (platform 30% floor / creator remainder). It returns `{ balance, already_unlocked, creator_share, platform_share }`.
- `UnlockService.purchaseUnlock` is refactored to fetch the version, enforce the status guard, and call this single RPC — replacing the prior insert-then-two-RPC split. `processRevenueSplit` is retained as an ad-hoc/admin API (no longer on the unlock path) to avoid orphaning `spendCoins`.

**Status guard (V7)**
- `purchaseUnlock` rejects any version whose `status` is not `published` before charging.

**Ledger idempotency + cleanup (V5)**
- A partial UNIQUE index on `wallet_transactions(reference_id) WHERE type = 'topup' AND reference_id IS NOT NULL` guarantees a given Xendit payment id is creditable as a topup at most once, scoped narrowly so it does not collide with per-version purchase/reward references.
- The dead, broken `numeric` overloads of `add_coins_atomic`/`spend_coins_atomic` (which omit the NOT-NULL `balance_after`) are dropped; the integer overloads the code actually calls remain.

**Rate limiting (V9)**
- A `TopupThrottleGuard` (NestJS `CanActivate`) applied to topup creation, backed by the global `RedisService` (`incr` + `expire`): 5 creations per 60s per uid, failing **open** when Redis is unavailable so an L2 outage never blocks a legitimate payment.

**Schema / DB changes** (applied to the live Supabase project via migration; `Backend/supabase-migration.sql` is reference-only and updated to match): the topup-scoped unique index, the dropped numeric overloads, and the new `purchase_unlock_atomic` function.

**Environment contract additions:** `XENDIT_WEBHOOK_SECRET` (required in production), `XENDIT_ALLOW_SIMULATE` (must be unset/false in production).

## Testing Decisions

A good test asserts **external behavior at the highest seam**, not implementation details — it survives a refactor of the internals. Prefer the existing service/guard specs (which mock the service-role Supabase client and collaborators) over new seams; add a new seam only where a genuinely new unit exists.

- **`WalletService.processXenditWebhook`** (existing seam, `wallet.service.spec.ts` — mocked Supabase client + mocked `XenditService` + mocked wallet-events): covers constant-time token, mandatory-HMAC-in-production, active-verification success, amount-mismatch reverts-and-refuses, non-SUCCEEDED reverts-and-refuses, Xendit-unreachable reverts-and-throws, idempotent re-claim. Prior art: the existing webhook + HMAC describe blocks in the same file.
- **`resolveXenditWebhookConfig` / `safeTokenEqual`** (new seam, pure function): fail-closed matrix and constant-time compare, unit-tested in isolation. Prior art: `auth/turnstile.config.spec.ts`.
- **`XenditService.getPaymentRequest`** (new seam): mock global `fetch`; assert status/amount mapping and error on non-ok. Prior art: fetch-mocking pattern used elsewhere in the backend.
- **`WalletService` amount guards + `simulateTopup` gate** (existing seam): integer/min/max rejection, flag-gated forbidden. Prior art: existing `addCoins`/`spendCoins`/`simulateTopup` describe blocks.
- **`WalletController.topup`** (existing seam): flag-gated forbidden + DTO validation. Prior art: existing controller spec.
- **`UnlockService.purchaseUnlock`** (existing seam, now mocking `db.rpc('purchase_unlock_atomic')`): charges via RPC, already-unlocked, insufficient-funds → BadRequest, free chapter, not-found, no-creator, non-published rejected. Prior art: the existing `purchaseUnlock` describe block, retargeted from `processRevenueSplit` to the RPC.
- **`TopupThrottleGuard`** (new seam): mocked `RedisService` + `ExecutionContext` — under-limit allow, over-limit 429, fail-open when Redis returns 0, TTL set only on first hit.

**SQL layer (decided): mocked-RPC unit tests + live smoke test.** The atomic guarantees live in Postgres, below the TypeScript seam (the unit tests mock the RPC). The atomic function and the idempotency index are therefore verified by a live smoke test after the migration is applied (function signature check; one real sandbox topup → simulate → webhook crediting exactly once; an unlock that charges once and credits the creator), not by a new Postgres integration harness. The codebase has no Jest-against-real-Postgres integration layer today, and adding one is out of scope.

## Out of Scope

- Introducing RLS backstop policies on `unlocks`/`wallet` (an open ADR-013 follow-up) — the authorization model is unchanged here.
- Building a Jest-against-real-Postgres integration test harness.
- Refunds, chargebacks, payout/withdrawal flows for creators, or any change to the 70/30 split percentage.
- Currency/FX handling beyond the existing THB 1:1 coin invariant.
- Frontend topup/unlock UX changes (the topup dedicated-pages migration is a separate plan).
- Changing the Turnstile / HardwareId asset-protection guards.
- Migrating off the static-token + HMAC webhook scheme to a different provider verification model.

## Further Notes

- Severity ranking from the audit: V1 critical (free coins), V2–V4 high, V5–V6 medium, V7–V9 low. V1–V3 are the directly-exploitable money paths and should land first; the webhook tasks are sequential (boot config → mandatory HMAC/constant-time → active verification) because they edit the same flow.
- The active-verification step adds one synchronous Xendit GET on the webhook hot path. This is an intentional trade: an unverifiable webhook delays crediting (Xendit retries) rather than ever fabricating coins.
- A full task-by-task implementation plan with TDD steps and exact code already exists at `docs/superpowers/plans/2026-06-22-wallet-security-hardening.md`.
- Pre-deploy: set `XENDIT_WEBHOOK_SECRET` in production, ensure `XENDIT_ALLOW_SIMULATE` is unset/false, confirm Xendit sends the signature header, and take a Supabase backup before the index/function migrations.
