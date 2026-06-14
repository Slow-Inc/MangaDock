# ADR 014 — Frontend single-entry server-side proxy: `/api/proxy` catch-all with token preservation, abort propagation, and static-asset rewrites

- **Status:** Accepted (2026-06-14) — implemented. All three pieces (catch-all proxy, abort/cancel chain, static rewrites) exist in the current code.
- **Area:** Frontend
- **Related:** the backend cancel-propagation work (`books.service.ts` batch registry, MIT `server/cancellation.py`) — this ADR documents the *frontend* hop that completes that chain.

## Context

Every browser API call in MangaDock needs three things at once: the Supabase Bearer token must reach the NestJS backend, the call must work from any host the app is served on (localhost dev, LAN IP, Radmin VPN, and the `hayateotsu.space` Cloudflare Tunnel), and it must not trip CORS. Doing this with direct browser→backend URLs forces a choice between hard-coding a backend origin (breaks on every other host/IP) and exposing the token + a CORS allow-list at the network edge.

A second force is resource efficiency. Batch manga translation is a long-running SSE stream backed by a GPU job on the MIT server. When a user navigates away or cancels, the browser aborts the request — but unless that abort travels all the way down, the backend keeps streaming and MIT keeps burning GPU on a job nobody is listening to.

A third force is asset serving. Translated-page patches and cached images live on the backend filesystem (`/uploads/*`, `/img-cache/*`). If the browser fetched those from the backend's own domain, that domain would have to be public and CORS-open, breaking the same encapsulation the API proxy provides.

## Decision

Make Next.js the **single entry point** for all browser traffic. Three concrete mechanisms:

**1. Catch-all server-side API proxy.** `Frontend/app/api/proxy/[...path]/route.ts` handles `GET/POST/PUT/PATCH/DELETE` for every `/api/proxy/<path>?<qs>` and forwards it server-to-server to NestJS. The browser only ever issues **relative** URLs — `const API_BASE = "/api/proxy"` is used throughout `AuthContext.tsx` (e.g. `${API_BASE}/users/me`) and across ~30 frontend files. Because the relative URL resolves against whatever host the page is on, the same build works on localhost, LAN, VPN, and tunnel without reconfiguration.

The proxy upstream is chosen as `process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001"` — `INTERNAL_API_URL` (localhost) is preferred so that, when deployed behind Cloudflare Tunnel, the server-to-server hop does **not** route back out through the public tunnel a second time.

The token stays off the edge: the browser's `Authorization` header is forwarded by the proxy, but the proxy strips a `SKIP` set of headers before calling upstream — `host`, `connection`, `transfer-encoding` (hop-by-hop) plus `origin` and `referer`. Dropping `origin`/`referer` is deliberate: this hop is already server-side, so forwarding them would only make NestJS run a CORS check against the browser's public IP (not in any allow-list) and reject the call. Response headers are copied back minus `transfer-encoding`/`connection`. On upstream failure the proxy returns a `502 { ok: false, error: "Backend unreachable" }`.

**2. Abort propagation to the GPU.** The proxy forwards `req.signal` into the upstream `fetch`, with `duplex: body ? "half" : undefined` so a streaming request body is allowed (Node 18+ fetch). This is the load-bearing link in a four-hop cancel chain:
   - browser aborts the SSE request →
   - Next.js proxy's `req.signal` aborts the upstream fetch, closing the connection to NestJS →
   - the SSE controller's `res.on('close')` fires (`books.controller.ts`) and calls `removeBatchListener(...)` →
   - when the last listener is gone, `books.service.ts` calls `job.cancelController.abort()` **and** fires `POST {MIT}/cancel/{jobKey}` →
   - MIT's `server/cancellation.py` marks the task cancelled; the batch loop checks `is_cancelled()` between pages and stops the GPU work.

Without the `req.signal` forward at the proxy hop, the upstream connection stays open, `res.on('close')` never fires, and the rest of that chain never runs.

**3. Static-asset rewrites.** `next.config.ts` `rewrites()` maps `/uploads/:path*` and `/img-cache/:path*` to the same backend base URL (`INTERNAL_API_URL ?? NEXT_PUBLIC_API_BASE_URL ?? http://localhost:3001`), so backend-served files also flow through Next.js as the single front door — the backend domain need not be exposed. Complementing this, `images.remotePatterns` is an explicit allow-list of external image hosts (Google Books, MangaDex CDN, Google/Facebook avatar CDNs, DiceBear, plus `localhost:4001` and `api.hayateotsu.space`), and `localPatterns` restricts the optimizer to `/api/**`. Frontend asset helpers (`app/lib/imgUrl.ts`) keep asset URLs relative (`/uploads`, `/img-cache`, `/api/img-proxy`) so they ride the same single entry point — unless `NEXT_PUBLIC_USE_CF_WORKER` redirects them to the Cloudflare Worker.

## Alternatives considered

- **Direct backend URLs from the browser.** Rejected — would expose the Supabase token at the network edge, hard-code a backend origin that breaks on every other host (LAN/VPN/tunnel), and require a CORS allow-list. The relative-URL proxy removes all three problems at once.
- **Heartbeat / TCP-timeout cancellation** instead of abort-signal propagation. Rejected — more complex and slower to react. The backend already runs a 15 s SSE heartbeat to keep the connection alive through Cloudflare's idle timeout, but relying on a *timeout* to detect a gone client wastes GPU for the timeout window; the synchronous abort chain stops the job the moment the socket closes.
- **Exposing the backend domain for asset serving.** Rejected — breaks the single-entry encapsulation and would itself need CORS. The `next.config.ts` rewrite keeps `/uploads` and `/img-cache` behind the same Next.js front door.
- **nunchaku / sd.cpp style heavier integrations** — out of scope here; this ADR is purely the request-flow layer.

## Consequences

- **Positive:** one chokepoint for auth, CORS, and asset serving — easy to reason about and audit; relative URLs make the same build run on localhost/LAN/VPN/tunnel unchanged; the Bearer token never appears at the network edge; `INTERNAL_API_URL` avoids double-tunneling; the abort chain stops cancelled translations from burning GPU; backend asset domain stays private.
- **Negative / limits:** every browser→backend call pays an extra server-side hop through Next.js (latency + a Node process in the path). The whole system funnels through one route handler, so a bug there is global. The abort-signal forward is the *only* thing in the frontend stopping a cancelled translation from running to completion on the GPU — a subtle, easily-regressed invariant with no obvious symptom if it breaks (the stream just keeps running server-side). The `next.config.ts` rewrite list **and** the `images.remotePatterns` allow-list must both be updated by hand whenever a new asset host or image CDN is added, or images silently fail to optimize/load.
- **Follow-ups:** the abort→GPU chain has backend unit coverage (`books-batch-cancel.spec.ts`, `books-pubsub-batch.spec.ts`) but the frontend proxy hop itself (`req.signal` forward, `SKIP` header set, `duplex: 'half'`) is not directly unit-tested — a regression test at the proxy boundary would protect the invariant. If the Cloudflare Worker asset path (`NEXT_PUBLIC_USE_CF_WORKER`) becomes the default, the `/uploads`/`/img-cache` rewrites become dead weight and could be removed.
