# Health Status Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `up/degraded/down` health status for Frontend and Backend services, displayed in dashboardv2's Overview Subsystems board and per-view header chips. MIT status already derives from the existing SSE stream.

**Architecture:** Backend adds an unauthenticated `@Get() getStatus()` using its existing `CacheHealthService` (already injected in `StatusController`); Frontend Next.js adds `app/status/route.ts` (checks Supabase env); dashboardv2 has a server-side `/api/service-status` aggregator that calls both concurrently with `Promise.all` + 1.5s `AbortSignal.timeout`; `useServiceStatus` polls every 5s; `StatusChip` renders results in the `NoDataView`'s `ViewShell.right` slot and in the Subsystems board pills.

**Tech Stack:** NestJS (Backend), Next.js App Router (Frontend + dashboardv2), bun:test, TypeScript, `AbortSignal.timeout`, CSS var tokens.

## Global Constraints

- Status enum: `"up" | "degraded" | "down"` only — matches MIT vocabulary
- Response schema: `{ schemaVersion:1, service, status, reason, checks[], uptimeSec, durationMs, checkedAt }`
- `/status` endpoints: **NO auth guard** — must return 200 even when Redis/Supabase are down
- No secrets, credentials, stack traces, internal URLs, or Redis keys in any `/status` response
- Probe timeout: 1.5s via `AbortSignal.timeout(1500)` in `probeService()`
- Poll interval: 5s in `useServiceStatus`
- Color via CSS vars only — no Tailwind tone classes in StatusChip
- Mock mode: extend `lib/mock-live.ts` with `MOCK_SERVICE_STATUS`; global "MOCKUP DATA" badge handles honesty

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `Backend/src/status/status.controller.ts` | Modify | Add `@Get() getStatus()` (no guard), inline snapshot logic via existing `cacheHealth` |
| `Backend/src/status/status.controller.spec.ts` | Modify | Add GET /status tests: 200 shape, Redis-down → down, no-auth-required |
| `Frontend/app/status/route.ts` | **Create** | Unauthenticated FE health route (checks Supabase env vars) |
| `dashboardv2/lib/service-status.ts` | **Create** | Exported types + `probeService()` pure async function |
| `dashboardv2/lib/service-status.test.ts` | **Create** | bun:test unit tests for `probeService()` |
| `dashboardv2/app/api/service-status/route.ts` | **Create** | Server-side aggregator (`Promise.all` FE + BE) |
| `dashboardv2/.env.example` | Modify | Append `FRONTEND_STATUS_URL`, `BACKEND_STATUS_URL` |
| `dashboardv2/lib/mock-live.ts` | Modify | Append `MOCK_SERVICE_STATUS` export |
| `dashboardv2/components/use-service-status.ts` | **Create** | 5s poll hook, mock-aware |
| `dashboardv2/components/widgets.tsx` | Modify | Append `StatusChip` export |
| `dashboardv2/components/dashboard.tsx` | Modify | Imports + `useServiceStatus()` call + `toSubS()` helper + Subsystems wiring + `NoDataView right` prop |

---

### Task 1: Backend — `@Get() getStatus()` endpoint + tests

**Files:**
- Modify: `Backend/src/status/status.controller.ts`
- Modify: `Backend/src/status/status.controller.spec.ts`

**Interfaces:**
- Consumes: `this.cacheHealth.getHealth()` — already injected at constructor line 19
- Produces: `GET /status` → `StatusSnapshot` (shape defined below)

- [ ] **Step 1: Write the failing tests**

Add inside `describe('StatusController', ...)` in `Backend/src/status/status.controller.spec.ts`, after the closing `});` of the existing `describe('GET /status/cache', ...)` block:

```ts
// ─── GET /status ─────────────────────────────────────────────────────────────

describe('GET /status', () => {
  // S1 — shape contract
  it('returns schemaVersion:1 snapshot with correct shape', async () => {
    mockCacheHealth.getHealth.mockResolvedValue(MOCK_HEALTH);
    const res = await request(app.getHttpServer()).get('/status').expect(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(res.body.service).toBe('backend');
    expect(['up', 'degraded', 'down']).toContain(res.body.status);
    expect(typeof res.body.reason).toBe('string');
    expect(Array.isArray(res.body.checks)).toBe(true);
    expect(typeof res.body.uptimeSec).toBe('number');
    expect(typeof res.body.durationMs).toBe('number');
    expect(typeof res.body.checkedAt).toBe('string');
  });

  // S2 — Redis unreachable → status:down
  it('returns status:down when cacheHealth.getHealth throws', async () => {
    mockCacheHealth.getHealth.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app.getHttpServer()).get('/status').expect(200);
    expect(res.body.status).toBe('down');
    const redis = res.body.checks.find((c: { id: string }) => c.id === 'redis');
    expect(redis.status).toBe('down');
    expect(redis.latencyMs).toBeNull();
  });

  // S3 — no auth guard
  it('returns 200 when AuthGuard would deny (no guard on this route)', async () => {
    mockAuthGuard.canActivate.mockReturnValue(false);
    mockCacheHealth.getHealth.mockResolvedValue(MOCK_HEALTH);
    await request(app.getHttpServer()).get('/status').expect(200);
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
cd Backend
npx jest src/status/status.controller.spec.ts --no-coverage
```
Expected: FAIL — `expected 200, got 404` (route doesn't exist yet)

- [ ] **Step 3: Replace `Backend/src/status/status.controller.ts`**

```ts
import { Controller, Get, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StatusService, SystemStatusEvent } from './status.service';
import { CacheHealthService } from '../cache/cache-health.service';
import { AuthGuard } from '../auth/auth.guard';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

type ServiceStatus = 'up' | 'degraded' | 'down';
interface StatusCheck { id: string; status: ServiceStatus; latencyMs: number | null; detail?: string }
interface StatusSnapshot {
  schemaVersion: 1;
  service: string;
  status: ServiceStatus;
  reason: string;
  checks: StatusCheck[];
  uptimeSec: number;
  durationMs: number;
  checkedAt: string;
}

@Controller('status')
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly cacheHealth: CacheHealthService,
  ) {}

  @Get()
  async getStatus(): Promise<StatusSnapshot> {
    const t0 = Date.now();
    const checks: StatusCheck[] = [];
    let worst: ServiceStatus = 'up';

    const rt0 = Date.now();
    try {
      await this.cacheHealth.getHealth();
      const ms = Date.now() - rt0;
      const s: ServiceStatus = ms > 200 ? 'degraded' : 'up';
      checks.push({
        id: 'redis',
        status: s,
        latencyMs: ms,
        ...(s !== 'up' ? { detail: `latency ${ms}ms > 200ms threshold` } : {}),
      });
      if (s === 'degraded' && worst === 'up') worst = 'degraded';
    } catch {
      checks.push({ id: 'redis', status: 'down', latencyMs: null, detail: 'redis unreachable' });
      worst = 'down';
    }

    const reason =
      worst === 'up'
        ? 'all checks passed'
        : checks.find((c) => c.status !== 'up')?.detail ?? 'check failed';

    return {
      schemaVersion: 1,
      service: 'backend',
      status: worst,
      reason,
      checks,
      uptimeSec: Math.floor(process.uptime()),
      durationMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
    };
  }

  @Sse('stream')
  sse(): Observable<MessageEvent> {
    return this.statusService.getStatusStream().pipe(
      map((event: SystemStatusEvent) => ({ data: event })),
    );
  }

  @UseGuards(AuthGuard)
  @Get('cache')
  getCacheHealth() {
    return this.cacheHealth.getHealth();
  }
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
cd Backend
npx jest src/status/status.controller.spec.ts --no-coverage
```
Expected: PASS — 5 tests (SC1, SC2, S1, S2, S3)

- [ ] **Step 5: Smoke-test live endpoint** (Backend must be running)

```bash
curl http://localhost:3001/status
```
Expected: `{"schemaVersion":1,"service":"backend","status":"up",...}`

- [ ] **Step 6: Commit**

```bash
cd Backend
git add src/status/status.controller.ts src/status/status.controller.spec.ts
git commit -m "feat(status): add unauthenticated GET /status health endpoint"
```

---

### Task 2: Frontend — Create `Frontend/app/status/route.ts`

**Files:**
- Create: `Frontend/app/status/route.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Produces: `GET /status` → same `StatusSnapshot` schema (service: `"frontend"`)

- [ ] **Step 1: Create `Frontend/app/status/route.ts`**

```ts
import { NextResponse } from "next/server";

type ServiceStatus = "up" | "degraded" | "down";
interface StatusCheck { id: string; status: ServiceStatus; latencyMs: number | null; detail?: string }

export async function GET() {
  const t0 = Date.now();
  const checks: StatusCheck[] = [];
  let worst: ServiceStatus = "up";

  const hasSupabase =
    !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!hasSupabase) {
    checks.push({
      id: "supabase-env",
      status: "degraded",
      latencyMs: null,
      detail: "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set",
    });
    worst = "degraded";
  } else {
    checks.push({ id: "supabase-env", status: "up", latencyMs: null });
  }

  const reason =
    worst === "up" ? "all checks passed" : checks.find((c) => c.status !== "up")?.detail ?? "check failed";

  return NextResponse.json(
    {
      schemaVersion: 1,
      service: "frontend",
      status: worst,
      reason,
      checks,
      uptimeSec: Math.floor(process.uptime()),
      durationMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 2: Smoke-test live endpoint** (Frontend must be running on :4000)

```bash
curl http://localhost:4000/status
```
Expected: `{"schemaVersion":1,"service":"frontend","status":"up"|"degraded",...}`

- [ ] **Step 3: Commit**

```bash
cd Frontend
git add app/status/route.ts
git commit -m "feat(status): add unauthenticated GET /status health route"
```

---

### Task 3: dashboardv2 lib — `service-status.ts` + tests

**Files:**
- Create: `dashboardv2/lib/service-status.ts`
- Create: `dashboardv2/lib/service-status.test.ts`

**Interfaces:**
- Consumes: nothing (pure fetch wrapper)
- Produces: types `ServiceStatus`, `StatusCheck`, `ServiceSnapshot`, `ServiceStatusMap`; function `probeService(url, service): Promise<ServiceSnapshot>`

- [ ] **Step 1: Write failing tests first**

Create `dashboardv2/lib/service-status.test.ts`:

```ts
import { describe, it, expect, afterEach } from "bun:test";
import { probeService } from "./service-status";

const originalFetch = global.fetch;

describe("probeService", () => {
  afterEach(() => { global.fetch = originalFetch; });

  it("returns the parsed snapshot on HTTP 200", async () => {
    const snapshot = {
      schemaVersion: 1, service: "backend", status: "up", reason: "all checks passed",
      checks: [], uptimeSec: 100, durationMs: 12, checkedAt: "2026-07-02T00:00:00.000Z",
    };
    global.fetch = async () => new Response(JSON.stringify(snapshot), { status: 200 }) as Response;
    const result = await probeService("http://localhost:3001/status", "backend");
    expect(result.status).toBe("up");
    expect(result.service).toBe("backend");
    expect(result.schemaVersion).toBe(1);
  });

  it("returns status:down when fetch throws (timeout / unreachable)", async () => {
    global.fetch = async () => { throw new Error("AbortError"); };
    const result = await probeService("http://localhost:3001/status", "backend");
    expect(result.status).toBe("down");
    expect(result.service).toBe("backend");
    expect(result.schemaVersion).toBe(1);
  });

  it("returns status:down when response is non-200", async () => {
    global.fetch = async () => new Response("Bad Gateway", { status: 502 }) as Response;
    const result = await probeService("http://localhost:3001/status", "backend");
    expect(result.status).toBe("down");
    expect(result.reason).toContain("502");
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
cd dashboardv2
bun test lib/service-status.test.ts
```
Expected: FAIL — `Cannot find module './service-status'`

- [ ] **Step 3: Create `dashboardv2/lib/service-status.ts`**

```ts
export type ServiceStatus = "up" | "degraded" | "down";

export interface StatusCheck {
  id: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail?: string;
}

export interface ServiceSnapshot {
  schemaVersion: 1;
  service: string;
  status: ServiceStatus;
  reason: string;
  checks: StatusCheck[];
  uptimeSec: number;
  durationMs: number;
  checkedAt: string;
}

export interface ServiceStatusMap {
  frontend: ServiceSnapshot | null;
  backend: ServiceSnapshot | null;
}

function fallback(service: string, reason: string): ServiceSnapshot {
  return {
    schemaVersion: 1,
    service,
    status: "down",
    reason,
    checks: [],
    uptimeSec: 0,
    durationMs: 0,
    checkedAt: new Date().toISOString(),
  };
}

export async function probeService(url: string, service: string): Promise<ServiceSnapshot> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return fallback(service, `HTTP ${res.status}`);
    return (await res.json()) as ServiceSnapshot;
  } catch (e) {
    return fallback(service, e instanceof Error ? e.message : "unreachable");
  }
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
cd dashboardv2
bun test lib/service-status.test.ts
```
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
cd dashboardv2
git add lib/service-status.ts lib/service-status.test.ts
git commit -m "feat(dashboardv2): add service-status probe lib + unit tests"
```

---

### Task 4: dashboardv2 — Aggregator route + env

**Files:**
- Create: `dashboardv2/app/api/service-status/route.ts`
- Modify: `dashboardv2/.env.example`

**Interfaces:**
- Consumes: `probeService` from `@/lib/service-status`; env `FRONTEND_STATUS_URL`, `BACKEND_STATUS_URL`
- Produces: `GET /api/service-status` → `{ frontend: ServiceSnapshot, backend: ServiceSnapshot }`

- [ ] **Step 1: Create `dashboardv2/app/api/service-status/route.ts`**

```ts
import { NextResponse } from "next/server";
import { probeService } from "@/lib/service-status";

export const runtime = "nodejs";

export async function GET() {
  const [frontend, backend] = await Promise.all([
    probeService(
      process.env.FRONTEND_STATUS_URL ?? "http://localhost:4000/status",
      "frontend",
    ),
    probeService(
      process.env.BACKEND_STATUS_URL ?? "http://localhost:3001/status",
      "backend",
    ),
  ]);
  return NextResponse.json(
    { frontend, backend },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 2: Append to `dashboardv2/.env.example`**

Add these two lines at the end of the file (after the existing `MIT_STATUS_URL=` line):

```
# Service-status probes (server-side — never exposed to browser).
# Defaults work for local dev; override for staging/prod.
FRONTEND_STATUS_URL=http://localhost:4000/status
BACKEND_STATUS_URL=http://localhost:3001/status
```

- [ ] **Step 3: Smoke-test the aggregator** (dashboardv2 on :3000, FE on :4000, BE on :3001)

```bash
curl http://localhost:3000/api/service-status
```
Expected: `{"frontend":{"schemaVersion":1,...},"backend":{"schemaVersion":1,...}}`

- [ ] **Step 4: Commit**

```bash
cd dashboardv2
git add app/api/service-status/route.ts .env.example
git commit -m "feat(dashboardv2): add /api/service-status aggregator route"
```

---

### Task 5: dashboardv2 — Client hook + mock data

**Files:**
- Modify: `dashboardv2/lib/mock-live.ts`
- Create: `dashboardv2/components/use-service-status.ts`

**Interfaces:**
- Consumes: `isMockMode` from `@/lib/mock-mode`; `ServiceStatusMap` from `@/lib/service-status`
- Produces: `MOCK_SERVICE_STATUS: ServiceStatusMap`; `useServiceStatus(): ServiceStatusMap`

- [ ] **Step 1: Append `MOCK_SERVICE_STATUS` to `dashboardv2/lib/mock-live.ts`**

Add at the end of the file (after the last existing export):

```ts
import type { ServiceStatusMap } from "./service-status";

export const MOCK_SERVICE_STATUS: ServiceStatusMap = {
  frontend: {
    schemaVersion: 1,
    service: "frontend",
    status: "up",
    reason: "all checks passed",
    checks: [{ id: "supabase-env", status: "up", latencyMs: null }],
    uptimeSec: 86400,
    durationMs: 3,
    checkedAt: "2026-07-02T00:00:00.000Z",
  },
  backend: {
    schemaVersion: 1,
    service: "backend",
    status: "degraded",
    reason: "latency 340ms > 200ms threshold",
    checks: [{ id: "redis", status: "degraded", latencyMs: 340, detail: "latency 340ms > 200ms threshold" }],
    uptimeSec: 86400,
    durationMs: 341,
    checkedAt: "2026-07-02T00:00:00.000Z",
  },
};
```

- [ ] **Step 2: Create `dashboardv2/components/use-service-status.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { isMockMode } from "@/lib/mock-mode";
import { MOCK_SERVICE_STATUS } from "@/lib/mock-live";
import type { ServiceStatusMap } from "@/lib/service-status";

const INITIAL: ServiceStatusMap = { frontend: null, backend: null };

export function useServiceStatus(): ServiceStatusMap {
  const mock = isMockMode();
  const [status, setStatus] = useState<ServiceStatusMap>(mock ? MOCK_SERVICE_STATUS : INITIAL);

  useEffect(() => {
    if (mock) return;
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/service-status", {
          signal: AbortSignal.timeout(2000),
        });
        if (active && res.ok) setStatus(await res.json());
      } catch {
        // network error — keep stale value until next tick
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [mock]);

  return status;
}
```

- [ ] **Step 3: Commit**

```bash
cd dashboardv2
git add lib/mock-live.ts components/use-service-status.ts
git commit -m "feat(dashboardv2): add useServiceStatus hook + mock status fixture"
```

---

### Task 6: dashboardv2 — `StatusChip` in `widgets.tsx`

**Files:**
- Modify: `dashboardv2/components/widgets.tsx`

**Interfaces:**
- Consumes: `ServiceStatus` from `@/lib/service-status`
- Produces: `StatusChip({ status, label, reason? })` exported from `@/components/widgets`

- [ ] **Step 1: Append `StatusChip` to `dashboardv2/components/widgets.tsx`**

Add at the end of the file:

```tsx
import type { ServiceStatus } from "@/lib/service-status";

// StatusChip — dot + label + status pill for service health (up / degraded / down).
// Pass status=null while loading (renders a neutral "…" chip).
export function StatusChip({
  status,
  label,
  reason,
}: {
  status: ServiceStatus | null;
  label: string;
  reason?: string;
}) {
  const c =
    status === "up"
      ? "var(--success)"
      : status === "degraded"
        ? "var(--processing)"
        : status === "down"
          ? "var(--coral)"
          : "var(--ink-3)";
  return (
    <span
      title={reason}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-medium"
      style={{
        background: `color-mix(in oklch, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in oklch, ${c} 26%, transparent)`,
        color: c,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {label} · {status ?? "…"}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd dashboardv2
git add components/widgets.tsx
git commit -m "feat(dashboardv2): add StatusChip to widgets"
```

---

### Task 7: dashboardv2 — Wire `dashboard.tsx`

**Files:**
- Modify: `dashboardv2/components/dashboard.tsx`

**Interfaces:**
- Consumes: `useServiceStatus` from `@/components/use-service-status`; `StatusChip` from `@/components/widgets`; `ServiceSnapshot` from `@/lib/service-status`

- [ ] **Step 1: Update imports**

At line 28, change:
```ts
import { MetricCard, BreakdownBar } from "@/components/widgets";
```
to:
```ts
import { MetricCard, BreakdownBar, StatusChip } from "@/components/widgets";
```

After line 29 (`import { formatCompact } from "@/lib/format";`), add:
```ts
import { useServiceStatus } from "@/components/use-service-status";
import type { ServiceSnapshot } from "@/lib/service-status";
```

- [ ] **Step 2: Call `useServiceStatus()` in the `Dashboard` component**

Find the line `const mock = isMockMode();` inside the `Dashboard` function body (near line 814). Directly after it, add:
```ts
const svcStatus = useServiceStatus();
```

- [ ] **Step 3: Replace the `infra` helper + FE/BE subsystem entries**

Find lines 862-872 (the `infra` helper + `subsystems` array). Replace the entire block with:

```ts
// infra() still used for entries without a live source (Redis/Supabase/R2/Streams).
const infra = (label: string, detail: string) => ({ label, detail: mock ? detail : "no source", s: mock ? "ok" : "idle" as const });
const toSubS = (snap: ServiceSnapshot | null): "ok" | "error" | "idle" =>
  snap?.status === "up" ? "ok" : snap?.status === "degraded" || snap?.status === "down" ? "error" : "idle";
const subsystems = [
  { label: "Frontend", detail: svcStatus.frontend?.reason ?? (mock ? "Next.js · 12ms p50" : "no source"), s: toSubS(svcStatus.frontend) },
  { label: "Backend", detail: svcStatus.backend?.reason ?? (mock ? "NestJS · 28ms p50" : "no source"), s: toSubS(svcStatus.backend) },
  { label: "MIT", detail: m ? (m.status === "ok" ? "healthy" : `${m.status}`) : "offline", s: m ? (m.status === "ok" ? "ok" : "error") : "idle" as const },
  { label: "9arm gateway", detail: m?.gateway?.detail ?? (m ? "ok" : "—"), s: m?.gateway?.status === "down" ? "error" : m ? "ok" : "idle" as const },
  infra("Redis · L2", "pub/sub ok · 1ms"),
  infra("Supabase", "REST ok · 42ms"),
  infra("Cloudflare R2", "edge ok · 60ms"),
  infra("Streams", "3 / 3 healthy"),
];
```

- [ ] **Step 4: Add `right` prop to `NoDataView` (line 329)**

Change the function signature at line 329 from:
```tsx
function NoDataView({ Icon, name, tech, color, msg }: { Icon: LucideIcon; name: string; tech: string; color: string; msg: string }) {
```
to:
```tsx
function NoDataView({ Icon, name, tech, color, msg, right }: { Icon: LucideIcon; name: string; tech: string; color: string; msg: string; right?: React.ReactNode }) {
```

Change line 331 from:
```tsx
    <ViewShell Icon={Icon} name={name} tech={tech} color={color}>
```
to:
```tsx
    <ViewShell Icon={Icon} name={name} tech={tech} color={color} right={right}>
```

- [ ] **Step 5: Add `StatusChip` to Frontend and Backend view calls (lines 1303-1304)**

Change line 1303 from:
```tsx
          {view === "Frontend" && (mock ? <ServiceMockView name="Frontend" onOpenNode={setOpenNode} /> : <NoDataView Icon={Activity} name="Frontend" tech="Next.js 16 · React 19" color="var(--accent-violet)" msg="Telemetry not wired — Frontend /status pending (#283). This service has no live source yet; the panel populates once the endpoint ships." />)}
```
to:
```tsx
          {view === "Frontend" && (mock ? <ServiceMockView name="Frontend" onOpenNode={setOpenNode} /> : <NoDataView Icon={Activity} name="Frontend" tech="Next.js 16 · React 19" color="var(--accent-violet)" msg="Telemetry not wired — Frontend /status pending (#283). This service has no live source yet; the panel populates once the endpoint ships." right={<StatusChip status={svcStatus.frontend?.status ?? null} label="Frontend" reason={svcStatus.frontend?.reason} />} />)}
```

Change line 1304 from:
```tsx
          {view === "Backend" && (mock ? <ServiceMockView name="Backend" onOpenNode={setOpenNode} /> : <NoDataView Icon={Server} name="Backend" tech="NestJS 11" color="var(--accent-amber)" msg="Telemetry not wired — Backend /status pending (#282). This service has no live source yet; the panel populates once the endpoint ships." />)}
```
to:
```tsx
          {view === "Backend" && (mock ? <ServiceMockView name="Backend" onOpenNode={setOpenNode} /> : <NoDataView Icon={Server} name="Backend" tech="NestJS 11" color="var(--accent-amber)" msg="Telemetry not wired — Backend /status pending (#282). This service has no live source yet; the panel populates once the endpoint ships." right={<StatusChip status={svcStatus.backend?.status ?? null} label="Backend" reason={svcStatus.backend?.reason} />} />)}
```

- [ ] **Step 6: TypeScript check**

```bash
cd dashboardv2
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd dashboardv2
git add components/dashboard.tsx
git commit -m "feat(dashboardv2): wire service status into Subsystems board and view header chips"
```

---

## Self-Review

**Spec coverage:**

| grill-me decision | Task that covers it |
|---|---|
| Q1 — up/degraded/down per service | Task 1 (BE), Task 2 (FE) |
| Q2 — Overview Subsystems + per-view chip | Task 7 Steps 3, 5 |
| Q3 — dot + label + tooltip → `StatusChip` | Task 6 |
| Q4 — `{ schemaVersion:1, service, status, reason, checks[], uptimeSec, durationMs, checkedAt }` | Task 1, Task 2, Task 3 types |
| Q5 — redis >200ms → degraded; supabase-env missing → degraded | Task 1 (redis), Task 2 (supabase-env) |
| Q6 — `/api/service-status` Next.js aggregator | Task 4 |
| Q7 — 5s poll / 1.5s probe timeout / concurrent FE+BE | Task 3 (`AbortSignal.timeout(1500)` in `probeService`), Task 4 (`Promise.all`), Task 5 (`setInterval(poll, 5000)`) |
| Q8 — mock mode via `MOCK_SERVICE_STATUS` | Task 5 |
| Q9 — Phase 0→4 build order | Tasks 1→7 in this exact order |

**Placeholder scan:** None — every step has complete, runnable code.

**Type consistency:**
- `ServiceStatus` defined in `service-status.ts` (Task 3) → consumed by `StatusChip` (Task 6), `dashboard.tsx` (Task 7) ✓
- `ServiceSnapshot` defined in `service-status.ts` (Task 3) → used in `probeService` return, aggregator route, `toSubS()` param ✓
- `ServiceStatusMap` defined in `service-status.ts` (Task 3) → used as `useServiceStatus()` return type and `MOCK_SERVICE_STATUS` type ✓
- `probeService` defined in Task 3, imported in Task 4 aggregator ✓
- `MOCK_SERVICE_STATUS` defined in Task 5 Step 1, imported in `use-service-status.ts` Task 5 Step 2 ✓
- `StatusChip` exported from `widgets.tsx` (Task 6), imported via updated widgets import in Task 7 Step 1 ✓
