# MIT Dashboard

Standalone, out-of-band mission-control dashboard for the MIT translation pipeline
(PRD #279, [ADR 016](../docs/adr/016-staff-console-out-of-band-observability-aggregator.md) /
[ADR 017](../docs/adr/017-mit-status-stream-forward-jwt-verification.md)). Next.js 16 + React 19,
runs locally so it keeps working when the rest of the stack is down. Design system follows the docs-page
(shadcn + the semantic-token theme).

## Run

```bash
bun install
bun dev          # http://localhost:4100   (use localhost, not 127.0.0.1 — Next 16 blocks cross-origin HMR)
bun test         # bun:test — pure logic modules (lib/*.test.ts)
bun run build    # production build
```

## Environment (`.env.local` — gitignored; see `.env.example`)

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase OAuth login (same project as the app Frontend; the publishable/anon key is public). Unset → the login gate is bypassed and the dashboard runs on **mock** data. |
| `MIT_STATUS_URL` | Server-side target for the `/api/live` proxy (e.g. `http://127.0.0.1:5003`). The proxy forwards the dev's JWT to MIT's `/status/stream`. |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | OpenAI-compatible gateway (9arm) for the AI chat + incident summary. Unset → canned mock answers. |

## How the live data flows (ADR 017)

```
Browser  ──(Supabase Google OAuth)──>  session JWT
   │  fetch /api/live  (Authorization: Bearer <jwt>, same-origin)
   ▼
Next route /api/live  ──(server-to-server, forwards the JWT)──>  MIT GET /status/stream
   │   (holds no secret of its own)                                   │
   ▼                                                                  ▼
parseSseFrames → snapshot.reduce → live UI            MIT verifies the JWT INDEPENDENTLY
   (degrades to mock on any MIT failure)              (Supabase getUser) + gates to staff
```

The browser cannot set an `Authorization` header on `EventSource`, so the client uses a `fetch` stream to
the same-origin `/api/live`, which forwards the bearer to MIT. MIT verifies the token itself — a dashboard
compromise leaks no reusable secret. Live panels fall back to the mock view when signed out or MIT is down.

**Sign-in (standalone — mirrors the Frontend + GitHub):** Email/password + Google + Facebook + **GitHub**, via a
popup OAuth flow (`/auth/callback` postMessages the session back — no full-page redirect). Multi-provider link/unlink
lives in the in-app **Account** panel (sidebar). **Dev-console access requires a GitHub identity** — MIT enforces
`MIT_DEV_REQUIRE_PROVIDER=github` (default), so a Google/Facebook-only account is denied live data even if allowlisted.

**Manual-linking note:** the Supabase project has manual account-linking on, so a *fresh* GitHub sign-in onto an email
that already has an account is refused (anti-takeover). Sign in with your existing provider, then **link GitHub in
Account** — after linking, `providers` includes `github` and the dev gate passes.

**Setup:** add your Supabase user id to MIT's `MIT_STAFF_USER_IDS` (until the `staffLevel` claim hook lands). Enable
the GitHub provider in Supabase (Authentication → Providers → GitHub + a GitHub OAuth App's client id/secret); ensure
the redirect-URL allowlist covers `/auth/callback`. Set `MIT_DEV_REQUIRE_PROVIDER=` empty to allow any provider during
rollout.

## Layout

- `lib/` — pure, unit-tested logic (snapshot reducer, SSE parse, live-map, chat, markdown, …).
- `components/` — UI; `auth-gate.tsx` (OAuth gate + token context), `use-live-snapshot.ts` (live hook).
- `app/api/` — `live/` (authenticated SSE proxy to MIT), `chat/` (LLM proxy).
