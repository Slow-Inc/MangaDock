# ADR 012 — MIT integration security boundary: raw-byte HMAC webhook + Hardware-ID zero-trust middleware + anti-corruption controller

- **Status:** Accepted (2026-06-14) — implemented. All three legs are live in the backend
  (`main.ts`, `mit-webhook.controller.ts`, `hardware-id.middleware.ts`, `books.service.ts`).
- **Context:** #95 (S1 raw-body HMAC, S2 secret policy, S3 patch-size bound) · T4-STANDARD Pillars 2
  (idempotent webhooks) & 5 (zero-trust asset protection).
- **Scope:** the Node (NestJS) ↔ Python (MIT) trust boundary only; in-app auth (Supabase JWT via
  `AuthGuard`) is a separate, complementary posture.

## Context

The NestJS backend talks to an external, separately-deployed Python ML server (MIT) over HTTP, and
serves paid/protected manga content to clients. Two distinct directions cross a trust boundary and
each carries an injection/exfiltration risk:

1. **MIT → backend (inbound webhook).** MIT posts translated-page results to
   `POST /webhooks/mit/callback`. The payload carries base64 PNG patches that are composited onto the
   page and cached for 7 days. An unauthenticated or forgeable results endpoint would let **anyone
   inject translations** (overwriting the art a reader sees) — a content-integrity attack.
2. **Client → backend (protected content).** Chapter pages, translate routes, version delivery, and
   uploads must not be served to clients that don't present a device identity. This is the
   zero-trust lever protecting paid content.

These look like several unrelated auth decisions but are really **one security boundary** between the
Python translator and the Node backend, plus its client-facing edge. Three constraints make the
naive implementations wrong:

- The webhook HMAC must be computed over **exactly the bytes MIT signed**. Re-serializing the parsed
  JSON is not byte-stable — key order can change through middleware transforms, and float formatting
  differs (Python `json.dumps` emits `1.0`, `JSON.stringify` emits `1`). A re-serialized HMAC would
  pass in unit tests yet silently reject (or, worse with a lax comparator, accept) real MIT traffic.
- The HWID requirement must apply to content routes **but not** to auth/forum/wallet/user routes,
  which have a different posture (Supabase JWT). A blanket guard would break login and the forum.
- MIT speaks a **flat wire format**; the service layer expects a structured domain shape. Letting the
  flat shape leak into the service couples the domain to MIT's transport.

## Decision

Secure the seam with three coordinated choices.

### 1. Raw-byte HMAC-SHA256 webhook with mandatory-in-prod secret

`bodyParser` is disabled at app creation and `express.json()` is re-registered with a `verify` hook
that captures the raw request buffer onto `req.rawBody`
(`Backend/src/main.ts` — `NestFactory.create(..., { bodyParser: false })` then
`app.use(json({ limit: '50mb', verify: (req, _res, buf) => { req.rawBody = buf } }))`). The
`limit: '50mb'` also lifts the default 100 KB cap, since patch bodies run ~1–3 MB.

`MitWebhookController.handleCallback` (`Backend/src/books/mit-webhook.controller.ts`) computes
`HMAC-SHA256(secret, req.rawBody)` and compares it to the `x-mit-signature` header with
`crypto.timingSafeEqual` (after a length check, since `timingSafeEqual` throws on length mismatch).
The verification falls back to `Buffer.from(JSON.stringify(body))` **only** when there is no Express
request (e.g. direct unit invocation) — production traffic always uses `rawBody`.

Secret policy (#95 S2, resolved 2026-06-05), enforced at runtime in the controller:
- **secret set** → verify every callback; missing/invalid signature → `401`.
- **no secret + `NODE_ENV === 'production'`** → `401` ("Webhook secret not configured"):
  misconfiguration fails loudly rather than leaving an open inject endpoint.
- **no secret + non-production** → accept unauthenticated (local dev runs MIT without a secret on
  purpose).

`MIT_WEBHOOK_SECRET` is declared `@IsOptional()` in `Backend/src/common/env.validation.ts`, so the
prod requirement is **not** enforced at boot — it is a runtime check inside the controller.

### 2. Hardware-ID zero-trust middleware (regex allow-list)

`HardwareIdMiddleware` (`Backend/src/common/middleware/hardware-id.middleware.ts`) is applied to
**all** routes (`consumer.apply(HardwareIdMiddleware).forRoutes('*')` in
`Backend/src/app.module.ts`), but only *enforces* on an explicit `HWID_REQUIRED` regex allow-list:

- `^/books/chapters/[^/]+/pages`
- `^/books/chapters/[^/]+/[^/]+-translate`
- `^/books/translate/mit-health`
- `^/versions/[^/]+(/|$)`
- `^/upload/`

A request matching the allow-list with no `x-hardware-id` header gets a `401` JSON body
("Missing hardware ID") **before** the controller runs; a present HWID is stashed on
`req.hardwareId` and the request continues. Everything not on the list (auth, forum, wallet, users)
passes straight through — those are deliberately guarded by `AuthGuard`/Supabase JWT instead, a
different trust posture. Forum is intentionally **not** HWID-gated.

### 3. Anti-corruption controller + in-memory per-page idempotency

`MitWebhookController` is the anti-corruption layer between MIT's wire format and the service domain.
MIT sends a flat payload `{ taskId, pageIndex, imgWidth, imgHeight, patches, regions, error }` (the
same flat shape the NDJSON streaming path reads). The controller destructures it, validates `taskId`
(`400` if missing), short-circuits informational `stage`-only progress events
(`notifyBatchProgress`, fire-and-forget), and otherwise repackages the fields into the structured
`result = { imgWidth, imgHeight, patches, regions }` object that
`BooksService.handleMitCallback` expects. The service never sees MIT's transport shape.

Idempotency lives in `BooksService` (`Backend/src/books/books.service.ts`). Batch jobs are tracked in
an **in-memory** `Map`, `activeBatchJobs = new Map<string, BatchJobState>()`, where each
`BatchJobState` holds `completedPages: Map<number, PageResult>` and `processingPages: Set<number>`.
`handleMitCallback` locks **synchronously before any `await`**: if the page is already in
`completedPages` or `processingPages` it logs and returns; otherwise it adds to `processingPages`,
does the work, then `processingPages.delete(pageIndex)` / `completedPages.set(...)`. This rejects
duplicate concurrent webhooks for the same page. A patch-size bound (#95 S3) drops any individual
patch whose base64 exceeds 5 MB before persistence.

## Alternatives considered

- **HMAC over re-parsed/re-serialized JSON** — rejected. `JSON.stringify(body)` is not byte-identical
  to what MIT signed (key-order and float-format divergence), so the signature would silently fail or
  weaken on real traffic. The `rawBody` capture exists precisely to avoid this; re-stringify survives
  only as a no-Express-request fallback.
- **Path-level guards (`@UseGuards`) instead of middleware** — rejected for the HWID check.
  Middleware runs and can `401` **before** the controller/guard chain initializes, which is the
  desired zero-trust posture for protected-asset routes; a guard runs later in the lifecycle.
- **Require HWID on every route** — rejected. Auth/forum/wallet/user endpoints need a different
  posture (Supabase JWT via `AuthGuard`); a blanket HWID requirement would break login and the forum.
  Hence the allow-list rather than a deny-list.
- **Service consuming MIT's flat payload directly** — rejected. It would couple `BooksService` to
  MIT's transport format; the controller adapts flat→structured so the domain stays MIT-agnostic.
- **DB unique constraint for webhook idempotency** — deferred, not adopted. In-memory
  `completedPages`/`processingPages` is sufficient and simplest for the current single-backend
  deployment; a durable/cross-process store is only needed once the backend is clustered.

## Consequences

- **Positive:**
  - Translation-injection is blocked in production: an unsigned or wrongly-signed callback (or a
    missing-secret misconfiguration) is `401`'d, and the HMAC is over the exact signed bytes with a
    constant-time comparison.
  - Paid/protected content (chapter pages, translate, versions, uploads) is gated by device identity
    at the middleware edge, before any controller logic.
  - The service domain is decoupled from MIT's wire format; changing MIT's transport touches only the
    controller adapter.
  - Duplicate concurrent webhooks for the same page are deduplicated, so a page is composited/cached
    once.
- **Negative / limits:**
  - **Raw-body capture is fragile.** Any future middleware that re-serializes or mutates the body
    before `verify` runs would break the HMAC **silently** (verification fails on real traffic while
    unit tests using the stringify fallback still pass). This coupling between `main.ts` body-parser
    wiring and the controller is non-obvious.
  - **In-memory idempotency is lost on restart** and is **per-process** — a backend restart mid-batch
    drops the `activeBatchJobs` state, and a clustered/multi-instance deployment would not share
    `completedPages`/`processingPages`, so dedup would not hold across instances.
  - **The HWID allow-list must be kept in sync** with content routes: any new protected route must be
    added to `HWID_REQUIRED` or it ships unguarded by HWID. The regex list is the single point of
    truth and is easy to forget.
  - The prod "secret required" rule is a **runtime** check in the controller, not a boot-time env
    assertion (the env var is `@IsOptional()`), so a missing secret is only discovered when the first
    webhook arrives.
- **Follow-up:**
  - Move idempotency to Redis (or a DB unique constraint) if/when the backend is clustered, so dedup
    and in-flight locks survive restart and span instances.
  - Consider promoting `MIT_WEBHOOK_SECRET` to a boot-time requirement when `NODE_ENV=production`, so
    misconfiguration fails at startup instead of on first callback.
