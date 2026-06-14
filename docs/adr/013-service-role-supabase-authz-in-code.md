# ADR 013 — Service-role Supabase singleton with authorization-in-code (RLS bypassed) plus optional/two-tier guards

- **Status:** Accepted (2026-06-14) — implemented. The service-role singleton, RLS-bypass posture, and all three guards are live in the Backend; the row-ownership checks they rely on are application code, not database policy.
- **Area:** Backend (NestJS)
- **Scope:** System-wide — every DB access in `Backend/src` flows through one client; the authorization model is foundational and costly to reverse.

## Context

Every NestJS module that touches Supabase (`wallet`, `users`, `unlock`, `forum`, `versions`, `books`, `upload`, `cache` workers, …) needs to read and write rows that belong to different users, share aggregate stats, debit wallets, and grant chapter unlocks. Two questions had to be answered once, for the whole backend:

1. **Which Supabase key/client does the server use?** An anon client honours Row-Level Security (RLS) and scopes data per-user via JWT; a service-role client bypasses RLS entirely and trusts the application to scope rows itself.
2. **How do HTTP routes establish identity** when some routes are public, some require login, and chapter-page delivery additionally needs zero-trust device binding (the asset-protection constraint in `HardwareIdMiddleware`)?

The forces: the backend already proxies all browser calls server-side (`/api/proxy/...`), so the server is trusted infrastructure, not the edge. Wallet revenue-split, unlock atomicity, and cross-user forum/stats reads all need to read or write rows the calling user does *not* own, which RLS policies make awkward. And the team wanted the fewest moving parts (North Star) over a second per-table policy surface kept in sync with the code.

## Decision

**One service-role client, authorization enforced in NestJS code, RLS deliberately bypassed.**

`SupabaseService` (`Backend/src/supabase/supabase.service.ts:10-26`) is the single client factory. In `onModuleInit` it reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (throws if either is missing) and calls `createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })`. It is registered `@Global()` (`supabase.module.ts:4`) and exported, so a single instance is injected everywhere. Services reach the DB through `this.supabase.client` — e.g. `UnlockService` exposes a `private get db() { return this.supabase.client; }` (`unlock.service.ts:20-22`). This service-role client is the sole DB path across the backend (~14 files reference `supabase.client`).

Because the service-role key bypasses RLS, **every row-ownership check is application code, not a database policy.** The canonical example is unlock: ownership is scoped by `.eq('uid', uid)` in the query itself — `isUnlocked` selects `from('unlocks').eq('uid', uid).eq('version_id', versionId)` (`unlock.service.ts:24-37`), `getUnlockedVersions` filters `.eq('uid', uid)` (lines 39-65), and `purchaseUnlock` writes `.insert({ uid, version_id, price_paid })` and rolls back with `.match({ uid, version_id })` (lines 96-121). There is no `unlocks` RLS policy enforcing this — the `uid` filter in code is the entire authorization boundary. The same pattern (`.eq('uid', uid)`) is how `wallet`, `users`, and `forum` services scope per-user rows.

**Identity is established by three guards, deliberately tiered:**

1. **`AuthGuard`** (`auth/auth.guard.ts:16-33`) — requires a `Bearer` token, calls `supabase.verifyAccessToken`, and on success stashes the decoded user on the request (`req[USER_KEY]`, `req[UID_KEY]`); otherwise throws `UnauthorizedException`. Note the contract: it validates that the JWT is *valid and the user exists* — it does **not** check that the user owns any particular row. Row ownership is the service layer's job (the `.eq('uid', uid)` above).
2. **`OptionalAuthGuard`** (`auth/optional-auth.guard.ts:1-23`) — if a `Bearer` token is present it decodes and stashes the user; if it is absent *or invalid*, it swallows the error and returns `true` anyway. This lets **one handler serve both public and logged-in views**: `forum.controller.ts` guards `GET posts` (and three more endpoints) with it (lines 61, 116, 128, 172), reading `req[USER_KEY]` to personalize when present; `versions.controller.ts:42` uses it on `GET :versionId` so anonymous callers see only `published` versions while an authenticated owner additionally sees their own drafts.
3. **`TurnstileGuard`** (`auth/turnstile.guard.ts:5-67`) — guards the chapter-pages endpoint (`books.controller.ts:121`, `GET chapters/:chapterId/pages`). It requires an `x-hardware-id` header and an `x-captcha-clearance` token, then verifies a **1-hour, HMAC-SHA256-signed clearance token bound to that exact hardware ID** (`generateClearanceToken` / `verifyClearanceToken`, expiry + HWID-match + `timingSafeEqual`). It is bypassable in dev via `TURNSTILE_ENABLED === 'false'` (line 46), and falls back to a hardcoded Cloudflare *test* secret (`1x0000...AA`, line 59) when `TURNSTILE_SECRET_KEY` is unset.

## Alternatives considered

- **Anon client + RLS for user-scoped data** — *rejected.* RLS would catch a missing ownership filter at the database, but it complicates the many flows that legitimately read/write rows the caller does not own (wallet revenue-split crediting a *creator*, shared chapter-view stats, unlock inserts). A service-role client keeps shared access across `wallet`/stats/`unlock` simple and avoids maintaining a second per-table policy surface in lockstep with the code. The server is already trusted infrastructure (all calls are server-side proxied), so the edge-protection RLS buys is lower-value here.
- **Separate public vs private forum endpoints** — *rejected.* Splitting each forum read into an anonymous route and an authenticated route doubles the controller surface. `OptionalAuthGuard` serves both from one handler by making auth best-effort and letting the handler branch on `req[USER_KEY]` presence.
- **A global `TurnstileGuard` (HWID + captcha clearance) on all routes** — *rejected as overkill.* The zero-trust device binding is only needed where protected assets are delivered (chapter pages). It is applied narrowly via `@UseGuards(TurnstileGuard)` on that one endpoint rather than registered globally.

## Consequences

- **Positive:** one client, one initialization path, injected globally — minimal moving parts and no policy/code sync burden; shared/cross-user flows (revenue-split, stats, unlock) are straightforward; `OptionalAuthGuard` collapses public + logged-in forum/version views into single handlers; chapter assets get hardware-bound, time-limited, signed clearance without forcing that weight onto every route; `AuthGuard`/`OptionalAuthGuard` reuse the same `verifyAccessToken` + `USER_KEY`/`UID_KEY` stash so the service layer reads identity uniformly.
- **Negative / limits:**
  - **Every row-ownership check is application code, not a DB policy.** A single forgotten `.eq('uid', uid)` is a silent cross-user data hole that RLS would have caught — the database will happily return another user's rows because the service-role key bypasses RLS. There is no defence-in-depth backstop; correctness rests entirely on each query.
  - **The decision is system-wide and expensive to reverse.** Moving to RLS later means authoring policies for every table *and* re-auditing every query that intentionally crosses user boundaries — it touches every module.
  - **`AuthGuard` only proves the JWT/user exists, not that they own the resource** — a non-obvious contract a future maintainer must not mistake for an ownership check.
  - **The `TURNSTILE_ENABLED=false` dev bypass and the hardcoded test secret fallback (`1x0000...AA`) must never reach prod.** If either leaks into a production environment, the hardware-bound chapter-asset gate is effectively open.
  - The single service-role key is a high-value secret; its leak grants full RLS-bypassing DB access.
- **Follow-up:** consider adding RLS policies as a *backstop* on the highest-risk tables (`unlocks`, `wallet`) even while keeping the service-role client, so a missed code filter fails closed; assert at boot that `TURNSTILE_SECRET_KEY` is set and `TURNSTILE_ENABLED !== 'false'` in production to prevent the dev bypass/test-secret from leaking; a lint/test guard that flags any `unlocks`/wallet query lacking a `uid` scope would convert the silent-hole risk into a CI failure.
