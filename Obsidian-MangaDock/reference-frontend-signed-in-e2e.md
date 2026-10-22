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
  (`/auth/v1/user` → the fake user, anything else → `{}`). Count those calls: in practice there were **0**, which
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

Related: [[reference-frontend-a11y-gotchas]] · [[feedback-verify-before-claiming]]
