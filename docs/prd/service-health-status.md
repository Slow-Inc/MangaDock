# PRD: Service Health Status Monitoring

**Status:** Draft  
**Author:** akkanop-x  
**Date:** 2026-07-02

---

## Overview

During an incident, the MIT Staff Console (dashboardv2) shows rich MIT pipeline telemetry but gives no signal about the health of Frontend or Backend — the two services an operator would first suspect when a translation request fails to reach MIT at all. This feature adds a lightweight `up / degraded / down` status indicator for Frontend and Backend (MIT is already derived from the live SSE stream) displayed in the Overview Subsystems board and in each service view's header chip, so an operator can rule out or confirm a service problem in one glance without switching to another tool.

---

## Goals

- An operator can see the health state of Frontend, Backend, and MIT at a glance on the Overview page within 5 seconds of the dashboard loading
- Each service view (Frontend, Backend) shows a header chip reflecting that service's current health
- Degraded conditions (Redis latency spike, missing Supabase env) surface as `degraded` — not silently treated as `up`
- Health endpoints are unauthenticated and return 200 even when their own dependencies are partially down — the dashboard must survive the storm
- Mock mode shows a designed scenario (FE up, BE degraded) so the UI is testable without live services

## Non-goals

- Per-request latency percentile tracking (p50/p99) — this is health status, not APM
- Alerting or paging (Slack, PagerDuty) — out of scope; dashboard is read-only
- Redis/Supabase/R2 health checks from the Frontend `/status` route — FE checks Supabase env only; Redis is a Backend responsibility
- Automatic recovery actions
- Per-node health breakdown — that belongs to the existing node popup (#279)
- MIT health endpoint — MIT already streams health via SSE; no new endpoint needed

---

## User Stories

1. As a **developer responding to an incident**, I want to see the health of Frontend, Backend, and MIT in one strip on the Overview page so that I can immediately rule out a service being down before diving into MIT pipeline details.

2. As a **developer on the Frontend view**, I want a status chip in the page header so I know whether Frontend is up or degraded without returning to the Overview page.

3. As a **developer on the Backend view**, I want a status chip in the page header so I can see Backend health alongside the "no telemetry" placeholder without switching views.

4. As a **developer with a slow Redis**, I want the Backend to report `degraded` (not `up`) when Redis latency exceeds 200ms so that the dashboard surfaces performance issues before they become outages.

5. As a **developer whose Supabase env vars are missing**, I want the Frontend to report `degraded` so I know auth will fail before any user hits the login screen.

6. As a **developer in mock mode**, I want the Subsystems board to show a designed scenario (FE up, BE degraded) so I can validate the UI layout and color logic without running any live service.

7. As a **developer running the dashboard offline** (e.g. no internet, services down), I want every unreachable service to show `down` with a tooltip explaining why, rather than crashing or hanging the dashboard.

8. As an **operator on a slow network**, I want the dashboard to keep showing the last known status while a poll is in-flight rather than resetting to a loading spinner, so the view remains readable during network hiccups.

---

## Functional Requirements

### Health Endpoints

- FR-1: `GET /status` on Backend (NestJS :3001) returns a `StatusSnapshot` JSON with no authentication guard. Redis is checked via the existing `CacheHealthService`; latency > 200ms → `degraded`; exception → `down`; otherwise `up`.
- FR-2: `GET /status` on Frontend (Next.js :4000) returns a `StatusSnapshot` JSON. Checks presence of `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; either missing → `degraded`; both present → `up`.
- FR-3: Both endpoints must return HTTP 200 regardless of dependency state. Status is expressed in the response body, never as an HTTP error code.
- FR-4: No secret values, credentials, stack traces, Redis keys, or internal URLs may appear in any `/status` response.
- FR-5: Response schema: `{ schemaVersion: 1, service, status, reason, checks[], uptimeSec, durationMs, checkedAt }` where `status` is `"up" | "degraded" | "down"`, `checks` is an array of `{ id, status, latencyMs, detail? }`.

### dashboardv2 Aggregator

- FR-6: `GET /api/service-status` (Next.js server route in dashboardv2) probes Frontend and Backend concurrently via `Promise.all`. Each probe has a 1.5s `AbortSignal.timeout`; a timeout or non-200 response yields a synthetic `down` snapshot for that service.
- FR-7: The aggregator is a server-side route — probe URLs (`FRONTEND_STATUS_URL`, `BACKEND_STATUS_URL`) are server-only env vars and never sent to the browser.
- FR-8: The aggregator response is `Cache-Control: no-store`.

### Client Polling

- FR-9: `useServiceStatus` hook polls `/api/service-status` every 5 seconds. On failure, the hook keeps the previous (stale) value — no reset to null or loading state.
- FR-10: In mock mode (`NEXT_PUBLIC_MOCKUP_MODE=true`), the hook returns `MOCK_SERVICE_STATUS` immediately and never fetches — no real network calls in mock mode.

### StatusChip Component

- FR-11: `StatusChip` renders a dot + `"{label} · {status}"` pill. Color: `var(--success)` for `up`, `var(--processing)` for `degraded`, `var(--coral)` for `down`, `var(--ink-3)` for null (loading). Color is also conveyed by shape (dot) and label text — not by color alone (color-blind safe).
- FR-12: The `reason` prop is surfaced as a native `title` tooltip.

### Dashboard Integration

- FR-13: Overview Subsystems board: the Frontend and Backend pills read from `useServiceStatus` — status dot, pill background, and tooltip all reflect live health. The other 6 subsystem entries (MIT, 9arm, Redis·L2, Supabase, R2, Streams) are unchanged.
- FR-14: Frontend view header: `NoDataView` gains a `right` slot; a `StatusChip` for Frontend is passed there so the health chip appears in the ViewShell header even when there is no telemetry panel.
- FR-15: Backend view header: same as FR-14 for Backend.

---

## Non-functional Requirements

- **Performance:** Each probe completes in ≤ 1.5s (hard timeout); `Promise.all` means total aggregator latency = max(FE, BE) ≤ 1.5s. Poll interval is 5s — well within the "glanceable in one second" PRODUCT.md goal.
- **Security:** `/status` is unauthenticated by design; it must not expose any credential, internal URL, or stack trace. Validated in Task 1 Step 3 (no `@UseGuards`) and FR-4 above.
- **Resilience:** A service being down must not crash the dashboard. `probeService()` catches all exceptions and returns a synthetic `down` snapshot. `useServiceStatus` keeps stale values on poll failure.
- **Accessibility:** Status is conveyed by dot shape + text label, not color alone. Tooltip (`title`) adds reason for screen readers. Follows existing WCAG AA baseline in PRODUCT.md.
- **Testability:** `probeService()` is a pure function with no side effects beyond `fetch`; tested with a mocked `global.fetch` in bun:test. Backend `getStatus()` is tested via the existing supertest harness.
- **Compatibility:** `AbortSignal.timeout` requires Node ≥ 17.3 / modern browsers — both already satisfied by the project's runtime targets.

---

## UX / UI Notes

- **Happy path (all up):** Overview Subsystems board shows Frontend and Backend pills with green dots and `up` label. Frontend/Backend view headers show a green `StatusChip`. Refreshes silently every 5s.
- **Degraded (e.g. BE Redis slow):** Backend pill turns coral-tinted with `degraded` text; hovering shows the reason (`latency 340ms > 200ms threshold`). Backend view header chip turns amber (`var(--processing)`).
- **Down (service unreachable):** Pill turns full coral; reason tooltip says `unreachable` or the fetch error message. This matches the existing coral design language for MIT incidents.
- **Loading (initial null state before first poll):** Chip renders `"… "` in neutral gray. Shown only on first page load before the first `/api/service-status` response returns (typically < 1.5s).
- **Mock mode:** FE chip is green (`up`), BE chip is amber (`degraded`, reason: "latency 340ms > 200ms threshold"). The global "MOCKUP DATA" footer label covers honesty — no extra "mock" badge needed on individual chips.
- **Offline / network error:** Poll fails silently; stale chip stays visible. No error banner or spinner disrupts the page.

---

## Technical Notes

**Endpoint location:** `Backend/src/status/status.controller.ts` already has `@Controller('status')` with `@Sse('stream')` and `@Get('cache')`; the new `@Get()` handler goes in the same controller — no new module or provider registration required.

**`CacheHealthService` reuse:** The controller already injects `CacheHealthService`. `getStatus()` times a call to `cacheHealth.getHealth()` to derive Redis latency — no new Redis connection or client is created.

**`probeService` design:** A single async function in `dashboardv2/lib/service-status.ts` that takes a URL and service name. On any error path (timeout, non-200, JSON parse failure) it returns a synthetic `down` snapshot rather than throwing — callers never need try/catch.

**Mock data isolation:** `MOCK_SERVICE_STATUS` lives in `lib/mock-live.ts` alongside `MOCK_MIT` and `MOCK_SERIES`. The `useServiceStatus` hook reads `isMockMode()` on mount; if true it initialises from the constant and skips `useEffect` — zero fetch calls in mock mode.

**`NoDataView` extension:** The component already uses `ViewShell` internally. Adding `right?: React.ReactNode` to its props and threading it to `ViewShell` is the only change required — the `ServiceMockView` path for mock mode is unaffected.

**Status schema versioning:** `schemaVersion: 1` is a literal `1` (not `number`) so TypeScript discriminates future schema versions without a runtime check.

---

## Success Metrics

- During any incident, the ops workflow eliminates "is Frontend/Backend down?" as a question within 5 seconds of opening the dashboard
- Zero dashboard crashes attributable to a service being down (probeService catches all exceptions)
- Backend `/status` test suite stays green under `npm test` with three new cases (shape, Redis-down, no-guard)
- `bun test lib/service-status.test.ts` passes all three `probeService` cases in < 1s

---

## Open Questions

- [ ] Should `GET /status` on Frontend also attempt a lightweight Backend proxy ping (e.g. `HEAD /api/proxy/status`) to detect proxy-layer failures? Current spec checks Supabase env only; a proxy timeout would be caught by the dashboardv2 aggregator's 1.5s timeout instead.
- [ ] Should the Subsystems board's Redis·L2, Supabase, and R2 entries eventually source from real health data (Backend `/status/cache` already has Redis info)? Currently they remain mock-only / "no source" — tracked separately as #283/#282 follow-ons.
- [ ] When MIT is offline and its SSE stream is `"offline"`, should the Subsystems MIT pill also reflect `down`? Currently it uses `m?.status` which would be `null` → `"idle"` (gray), not `"error"` (coral). Worth aligning vocabulary.
