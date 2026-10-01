# ADR 019 — MIT `/status` + `/status/stream`: hybrid SSE telemetry with forwarded-JWT, Supabase-verified independently

- **Status:** Accepted (2026-06-15) — implemented (MIT slice). Realizes Phase-1 (1d GPU/host metrics + 1f aggregator transport) of [ADR 018](018-staff-console-out-of-band-observability-aggregator.md) for the **MIT** service only; Backend (#282/#283) and Frontend status streams are out of scope here (akkanop-x is refactoring them).
- **Context PRD:** #279 · **Parent ADR:** 018 (out-of-band Dev console). **Builds on:** the MIT↔Backend HMAC boundary of [ADR 012](012-mit-integration-security-boundary.md) (this adds the **complementary** Dashboard↔MIT posture ADR 012 anticipated); the Supabase verification of [ADR 015](015-frontend-auth-context-supabase-adapter.md).
- **Refines ADR 018:** ADR 018 assumed "MIT gains a small **PyJWT** verification path." This ADR **overturns that detail** — MIT verifies the forwarded token by asking Supabase (`GET /auth/v1/user`), not by local crypto (rationale below). The architecture (out-of-band aggregator, per-service streams, zero-trust forward-JWT, no shared secret) is unchanged.

## Context

The Dev console (ADR 018) needs MIT's live telemetry — GPU/host metrics, the translator-gateway diagnosis (the 2026-06-14 model-hang signature), queue/worker state — surfaced out-of-band and gated so only staff can read it. The MIT-side primitives already existed (`server/metrics.py`, `server/diagnostics.py`, `server/translate_error.py`, committed under #279) but were **not exposed over HTTP**, and the Dashboard rendered mock data. Three decisions were open for this first slice; the operator chose each:

1. **Transport.** Event-style push is required ("we don't want a loop for the parts that can emit events"). Metrics are continuous (no event) and must be sampled.
2. **Auth.** Even if the Dashboard leaks, others must not gain access — independent per-service verification, no reusable secret.
3. **Breadth.** MIT only (Backend/Frontend are mid-refactor by another owner).

A fourth question surfaced during build: Supabase issues the new **asymmetric** `sb_publishable_…` keys, so a local HMAC verify (shared JWT secret) would not validate these tokens at all.

## Decision

1. **Hybrid SSE `/status/stream` + JSON `/status`, parent-server only.** `GET /status` returns a full snapshot; `GET /status/stream` emits a sampled `metric` frame every `MIT_STATUS_INTERVAL_S` (default 3 s) **and pushes** discrete `event` frames the instant they occur (enqueue, worker registered) via an in-process `StatusHub` (asyncio fan-out, `put_nowait` — a slow consumer drops, never blocks the translate path). The sampler loop lives **at the source** (ADR 018: the loop is moved, not eliminated); the event tier has **no** loop. Both routes live on the **parent** FastAPI server — never the worker, whose pickle endpoint binds 127.0.0.1 and is RCE-by-design (PIPELINE.md §6.8).

2. **Forwarded JWT, verified independently via Supabase `getUser` — not PyJWT.** The Dashboard signs the dev in (Supabase Google OAuth) and forwards the access token; MIT verifies it by calling Supabase `GET /auth/v1/user` (httpx — already a dependency), exactly as the Backend does (`SupabaseService.verifyAccessToken` → `auth.getUser`). Verification fails **closed** (a None result denies). Consequences vs the ADR-018-assumed PyJWT path:
   - **Zero new dependency, no JWT secret distributed to MIT** (one fewer secret to leak — strengthens "a dashboard leak grants nothing reusable").
   - **Robust to Supabase's signing scheme** (the new asymmetric `sb_publishable_…` keys verify; local HMAC would not).
   - **Consistent** with the Backend's existing verification.
   - Cost: one bounded network round-trip per verification — negligible for a 1–2-operator console; the SSE stream re-validates only every `MIT_STATUS_REVALIDATE_S` (default 60 s) and closes on expiry.

3. **Staff gate: signed claim OR allowlist, with provider enforcement.** `is_staff` admits a sufficient `staffLevel` claim (once ADR 018's Supabase Custom Access Token Hook lands) **OR**, for v1, a user id in `MIT_STAFF_USER_IDS`. Unknown principals get 403 — deny by default. **Dev-tier access is additionally forced onto an OAuth provider** via `MIT_DEV_REQUIRE_PROVIDER` (default `github`): the verified user must carry that identity (`app_metadata.provider`/`providers`), so even an allowlisted/claimed **Google** account is denied dev access — the highest-privilege console requires the GitHub identity that maps to the repo collaborators. The Dashboard carries its **own standalone auth** mirroring the Frontend — Email/password + Google + Facebook + **GitHub** — via the Frontend's popup OAuth flow (`/auth/callback` postMessages the session back) and an **in-app multi-provider link/unlink panel** (it does NOT depend on the Frontend, per ADR 018's standalone principle). Role intent: Moderator→Google, Admin→both, Dev→GitHub. Because the project has manual account-linking enabled, a *fresh* GitHub sign-in onto an existing-email account is refused by GoTrue (anti-takeover) — the dev signs in with their existing provider, then links GitHub in Account; after linking, `providers` includes `github` and the gate passes. Set `MIT_DEV_REQUIRE_PROVIDER=` empty to disable the requirement (e.g. during GitHub-provider rollout).

4. **Throttled gateway probe.** The diagnostic runs a real (bounded) chat completion, so it is cached and refreshed at most every `MIT_DIAG_INTERVAL_S` (default 30 s) — never per metric sample.

5. **Dashboard aggregator = authenticated SSE proxy.** A Next route (`/api/live`) forwards the browser's bearer to MIT's `/status/stream` (the browser's `EventSource` cannot set `Authorization`; a same-origin `fetch` stream can). The proxy holds **no secret of its own**. Frames fold through the committed `lib/snapshot.ts` reducer; on any MIT failure the client degrades to the mock view.

## Alternatives considered

| Option | Verdict |
|---|---|
| **Verify via Supabase `getUser`** | **chosen** — zero new dep, no secret in MIT, scheme-agnostic, matches Backend. |
| Local PyJWT verify (ADR 018's assumption) | rejected — needs the JWT secret distributed to MIT and fails on the new asymmetric keys; more surface for no benefit at this scale. |
| **Hybrid sample + push (SSE)** | **chosen** — matches the operator's "push events, sample metrics" and the two data natures. |
| Pure polling | rejected by the operator — wants event push, not a Dashboard-side loop. |
| Staff gate on valid-token-only | rejected — any app user's token would pass; the allowlist/claim restricts to staff. |
| Per-model VRAM attribution | deferred — kept mock (CUDA-allocator-approximate, ADR 018). |

## Consequences

- **Positive:** live GPU/host/gateway/queue telemetry with **zero new dependency** (httpx/psutil/nvidia-smi already present); independent per-service verification with **no shared secret**; event push with no event-tier loop; the worker pool is untouched (events come from the parent-process queue/registration seams); graceful degradation to mock when MIT is down or the dev is signed out.
- **Negative / costs:** a Supabase round-trip per verification (mitigated by 60 s SSE re-validation); the v1 staff gate needs each dev's id in `MIT_STAFF_USER_IDS` until the Custom Access Token Hook lands; `MIT_STATUS_URL` must point the Dashboard at the MIT running this code.
- **Follow-up:** the Supabase `staffLevel` claim hook (ADR 018 §Decision 1) to retire the allowlist; Backend (#282) + Frontend (#283) `/status/stream` reusing the same forward-JWT mechanism; per-stage event push from the worker (currently parent-process events only).
