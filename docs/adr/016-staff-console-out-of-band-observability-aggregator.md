# ADR 016 — Staff Console observability via a standalone out-of-band aggregator with per-service event streams

- **Status:** Accepted — **planned** (not yet implemented). PRD **#279**; Phase 1 slices **#280** (1a — RBAC `staffLevel` + signed-claim auth + gated `/staff` shell) / **#285** (1f — status aggregator microservice + per-service `/status/stream`) / **#282** (1b — subsystem health board) / **#283** (1c — live pipeline tracer + queue) / **#284** (1d — detailed GPU/host metrics) / **#281** (1e — precise translate-failure classification).
- **Context PRD:** #279 (Staff Console — role-tiered back-office + live MIT pipeline observability)
- **Trigger:** the 2026-06-14 incident — the `custom_openai` gateway at `gateway.9arm.co` was up but the `qwen3.6-35b-a3b` model hung; translate failed after ~90s with a bubbled-up `'ollama servers did not respond quickly enough'`, and finding *where* it was stuck took manual black-box probing.
- **Builds on:** the MIT integration security boundary of [ADR 012](012-mit-integration-security-boundary.md); the single-entry proxy of [ADR 014](014-frontend-single-entry-proxy.md); the Supabase auth adapter of [ADR 015](015-frontend-auth-context-supabase-adapter.md); the service-role/authz-in-code stance of [ADR 013](013-service-role-supabase-authz-in-code.md).

> **Implementation note (2026-06-18):** the decision (out-of-band aggregator + per-service SSE + zero-trust JWT)
> stands. Two details below differ from what was built: the dashboard is a **Next.js 16 app** with a server
> `/api/live` proxy (not a Fastify-bundled UI), and its design is **Speck + PremiumBuss + Arcana** (not "shadcn").
> The clean rebuild + canonical design/IA spec live in [`dashboardv2/DESIGN.md`](../../dashboardv2/DESIGN.md).

## Context

When the translate pipeline breaks there is **no single live view** of system / subsystem / queue / resource state. The 2026-06-14 incident surfaced only as a vague exception after ~90 s; diagnosing it (gateway `/models` OK in 0.19 s, but a 16-token completion timed out at 151 s → the inference backend was hung) required a developer to hand-probe each layer. The pain is **observability**: the error told us *that* it failed, never *where*.

A naive fix builds the dashboard inside the Backend. But **a monitor that shares a failure domain with the thing it monitors dies exactly when it is needed** — a Backend crash would blind the dashboard at the worst moment, and the operator could not even see "Backend DOWN".

Production adds a second constraint the operator stated directly: **the machine cannot be inspected directly**, so the console is the only window into the box. It must therefore show **detailed** host/GPU telemetry, and it must keep working (and alert) when services fail.

Two further realities shape the transport and the auth:

- **Two data natures.** Continuous status/metrics (VRAM/CPU/temp/health) have no "event" — something must **sample** them on an interval. Discrete events (translate triggered, stage transition, log line, error) occur sparsely and are **push-friendly**.
- **The data is sensitive** (gateway URLs, the queue with manga + requesting user, GPU, internal pipeline stages) and must not ride a public endpoint. Browser `EventSource` cannot send an `Authorization` header, and the Supabase session lives in `localStorage` (no auth cookie), so a browser-opened SSE cannot carry auth. A shared static secret held by the dashboard would be a **single point of compromise** if the dashboard source/config ever leaked.

## Decision

Build the Dev console's data plane as an **out-of-band aggregator**, deliberately outside the Backend's failure domain, with per-service event streaming and zero-trust auth.

1. **Orthogonal `staffLevel` role model.** A `staffLevel` (`none` < `moderator` < `admin` < `dev`) on `profiles`, separate from the content `role` (user/translator/creator), sourced from the authoritative `profiles` column — not the user-editable `user_metadata`.
2. **Standalone aggregator microservice (Node-Fastify, dependency-light).** Runnable on the dev's local machine or a separate host. It subscribes — server-to-server SSE — to each service's `/status/stream`, merges into a live in-memory **snapshot** (metrics) + **event feed**, and **serves its own UI** (the dashboard *is* its own service, not a Frontend page). Being a separate process from the Backend *and* the Frontend, it survives a crash of either and reports "Backend DOWN". The watcher is deliberately simpler / more reliable than what it watches.
3. **Per-service `/status/stream` SSE.** Frontend, Backend, and MIT each expose a stream that self-reports its own domain, multiplexing two message types: `{type:'metric'}` from a per-service sampler loop every *N* s (the continuous nature), and `{type:'event', kind:'translate_triggered'|'stage'|'log'|'error'}` pushed on occurrence (the discrete nature, no loop). The Backend re-emits the MIT stage webhook it already receives; MIT emits its gateway diagnostics + GPU/host metrics from the worker process; nothing in the translate worker pool is touched.
4. **Zero-trust signed-claim auth, no shared secret.** A Supabase **Custom Access Token Hook** injects the authoritative `staffLevel` (read from `profiles`) as a **signed claim** into the dev's JWT at issuance. The dashboard forwards the dev's JWT (it holds no master secret); **each service verifies the JWT independently** (signature + expiry) and reads the signed claim — server-to-server SSE *can* set the `Authorization` header, so the browser limitation does not apply. Streams **re-validate every ~60 s and close on token expiry**, so SSE stays zero-trust. MIT gains a small PyJWT verification path.
5. **Standalone UI, runnable locally.** The Dev monitoring dashboard serves its **own** UI (shadcn + the existing docs-page design), bundled into the same standalone service as the aggregator — so it runs even on the dev's local machine, independent of the Frontend. The Frontend never has to be up (or finished refactoring) to see the dashboard. Only the Dev monitoring dashboard is standalone; the Moderator (`/staff/moderation`) and Admin (`/staff/support`) consoles, which act on live app data, stay in the Frontend `/staff/*` shell and verify the same signed `staffLevel` claim.
6. **External uptime monitor → Discord** as the out-of-band backstop that survives even total box death and provides the "tell me, don't make me watch" alerting the production motivation demands.

## Alternatives considered

| Option | Verdict |
|---|---|
| **Standalone aggregator microservice** | **chosen** — only design that fully leaves the Backend failure domain *and* stays in-house; portable (local dev / separate prod host); dep-light watcher. |
| Aggregate inside the Backend (original PRD) | rejected — shares the Backend's failure domain; dies with it, blind when most needed. |
| Aggregate in the Frontend Next server | viable (separate process) but spreads probe credentials into the Frontend and Next is awkward for long-lived SSE subscribers; the standalone µservice is cleaner. |
| **Hybrid sampled-metric + pushed-event** | **chosen** — matches the two data natures; low idle load (events only fire on change) while continuous metrics are still sampled. |
| Pure polling (aggregator loops `GET /status`) | simpler and re-validates per request, but loops constantly and gives no low-latency events. |
| Pure SSE, validate once at connect | lower latency but the stream outlives the auth check (weaker zero-trust) — mitigated here by ~60 s re-validation + close-on-expiry. |
| Shared `STATUS_SECRET` held by the dashboard | rejected — single point of compromise; a dashboard leak hands an attacker every service. |
| Full per-service OAuth flow | rejected — impractical (MIT has no OAuth stack); forward-JWT + signed-claim achieves independent per-service verification with far less surface. |

## Consequences

- **Positive:** the dashboard keeps working through a Backend crash and names "Backend DOWN"; zero-trust per-service verification with **no shared secret** (a dashboard compromise leaks nothing reusable); event-driven push keeps idle load low while sampled metrics cover continuous signals; **detailed** host/GPU telemetry with **zero new MIT dependency** (`torch` + `psutil` already present); the external monitor guarantees out-of-band alerting; the design reuses existing seams — the MIT stage webhook, `activeBatchJobs`, the `studio/layout` gating pattern, and shadcn — rather than building new surface.
- **Negative / costs:** a new standalone microservice to run, deploy, and secure; MIT gains JWT verification (a small new surface, consistent with the zero-trust boundary of ADR 012); each service runs a sampler loop (unavoidable for continuous metrics — the loop moves to the source, it is not eliminated); SSE needs re-validation + reconnect/backoff logic; the role hierarchy adds a `profiles.staffLevel` column and a Supabase Custom Access Token Hook (a `staffLevel` change then needs a token refresh to take effect); "online users" stays approximate (presence is derived, not tracked); per-model VRAM attribution is CUDA-allocator-approximate.
- **Follow-up:** Phase 2 adds threshold alerting → Discord from the aggregator and the per-stage VRAM profile; Phase 3 adds the Moderator and Admin consoles (the financial Admin manual-credit path needs idempotency + an audit log, tracked separately); if SSE subscriber management proves heavy in practice, fall back to authenticated polling for the metric tier while keeping push for events.
