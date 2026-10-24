---
name: reference-frontend-signed-in-e2e
type: reference
description: How to E2E a signed-in frontend flow locally with no real account — fake Supabase session in localStorage + Playwright answering the Supabase host + the stand-in backend; and why not to use the developer's real browser session against a stand-in
---

Used for #987 / #988 (2026-10-22) to verify posting, replying, voting and reporting on a production build. Before
this, signed-in flows (anything behind `user ?`) were checked by reading only.

**Why it works:**
- supabase-js restores a session from `localStorage["sb-<project-ref>-auth-token"]` and makes **no network call**
  while `expires_at` is in the future. The JWT signature is never checked in the browser, so a structurally valid
  token is enough: base64url header and payload with `sub`, `exp`, `aal: "aal1"`, `role: "authenticated"`.
- `AuthContext` maps the Supabase user with `adaptUser` and takes `userRole` from the backend's `GET /users/me`. With the
  stand-in backend (no such route) that gives a regular user, role 0.
- Playwright `context.route(url => url.host === <supabase host>, …)` answers every Supabase request locally
  (`/auth/v1/user` → the fake user, a PostgREST read `/rest/v1/…` → `[]`, anything else → `{}`). An object for a
  `supabase.from(...)` read crashes any `.map` on it and reads as an app bug (it did, on `/settings/security`). Count those calls: in practice there were **0**, which
  proves nothing left the machine.
- `context.addInitScript` writes the session before any page script runs. Read `NEXT_PUBLIC_SUPABASE_URL` from
  `Frontend/.env` to derive the key; never print it.

**Don't** reuse the developer's real Chrome session against the stand-in backend. If a stand-in `/users/me` 404
were ever read as "account gone" and the app signed out, that would revoke the real session, an outward side effect.
The fake session has no such risk.

**Pair it with the stand-in backend modes**: a per-flag route set, plus `FLAKY_ONCE=<regex>`, which fails the first
matching request with 503, for red/green of failure paths. Put the flaky check **before** the route block it targets,
or the routes answer first. The stand-in stores nothing: after a write, assert on the request log (`[503, 201]`),
not on a list the page refetches.

**A role is a number, not a guess:** `ROLE` in `app/lib/types/user.ts` — creator 2, **admin 8**. An admin sweep with
role 3 just redirects to `/` and looks like a bug.

**When D: is full** (it was, 2026-10-23: `next build` had nowhere to write): junction `Frontend/.next` to a dir on C:,
and junction a `node_modules` *beside* that dir to the real `Frontend/node_modules` — Turbopack resolves
`@tailwindcss/postcss` from the junction's real path. Start the server with `node node_modules/next/dist/bin/next
start` (TaskStop on `npx next start` leaves the real server running the deleted build), and check the port owner
before trusting a red/green reading. Never delete through a junction — remove the junction itself.

**A whole-app sweep is cheap:** every route × 1280/390 px, asserting `scrollWidth <= clientWidth`, no visible
`img` with `naturalWidth === 0`, no `pageerror`, and the final URL. It found #1033 (an `sr-only` span escaping an
unpositioned `overflow-x-auto` scroller and widening the page by 296 px) that no unit test could see.

Related: [[reference-frontend-a11y-gotchas]] · [[feedback-verify-before-claiming]]
