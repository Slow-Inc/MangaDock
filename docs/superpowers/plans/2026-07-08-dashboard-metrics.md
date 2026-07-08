# dashboard-metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `dashboard-metrics/` — a standalone Fastify + prom-client Prometheus exporter that probes 6 services and exposes `/metrics`; instrument Backend and Frontend with prom-client; wire Grafana Alloy in docker-compose to push metrics to Grafana Cloud.

**Architecture:** Fastify server on port 9091 runs a `setInterval(15s)` probe loop over Frontend, Backend, Supabase, CF Worker, AI Gateway (mock), and MIT (mock); results update three Gauges (`mangadock_service_up`, `mangadock_service_degraded`, `mangadock_service_latency_ms`) in a prom-client registry; `/metrics` (Basic auth) serves Prometheus text format. Backend (NestJS) and Frontend (Next.js) each add `prom-client` with `collectDefaultMetrics()` + HTTP middleware and expose their own `/metrics`. Grafana Alloy in docker-compose scrapes all three `/metrics` endpoints and remote_writes to Grafana Cloud.

**Tech Stack:** Bun, Fastify ^4, @fastify/basic-auth ^5, prom-client ^15, NestJS 11, Next.js 16 (App Router), Docker Compose, Grafana Alloy

## Global Constraints

- Metrics prefix: `mangadock_` on all metric names
- Status mapping: `"up"` → up=1/degraded=0; `"degraded"` → up=0/degraded=1; `"down"` → up=0/degraded=0
- Probe timeout: 5000ms via `AbortSignal.timeout(5000)`
- Probe interval: 15s (`setInterval(15_000)`)
- `/metrics` requires Basic auth (`METRICS_BASIC_AUTH_USER` / `METRICS_BASIC_AUTH_PASS`)
- `/health` is unauthenticated
- CF Worker URL hardcoded: `https://assets.2552667.xyz/health` — non-5xx = up
- Supabase: `GET SUPABASE_HEALTH_URL` + header `apikey: SUPABASE_ANON_KEY` → `{"status":"Healthy"}` = up
- AI Gateway and MIT: mock stub, always returns up=1/degraded=0/latencyMs=0
- dashboard-metrics port: 9091
- No secrets in committed files — `.env` in `.gitignore`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `dashboard-metrics/package.json` | Create | Bun project, fastify + prom-client deps |
| `dashboard-metrics/tsconfig.json` | Create | TypeScript config for bun |
| `dashboard-metrics/Dockerfile` | Create | Bun image, run src/index.ts |
| `dashboard-metrics/.env.example` | Create | All required env vars documented |
| `dashboard-metrics/src/config.ts` | Create | Read + validate env vars, export `config` |
| `dashboard-metrics/src/metrics.ts` | Create | prom-client Registry + 3 Gauge definitions |
| `dashboard-metrics/src/probes.ts` | Create | 6 probe functions + `startProbeLoop()` |
| `dashboard-metrics/src/probes.test.ts` | Create | bun:test for all probe functions |
| `dashboard-metrics/src/index.ts` | Create | Fastify server, /health, /metrics, wire loop |
| `dashboard-metrics/alloy/config.alloy` | Create | Alloy scrape 3 targets + remote_write |
| `docker-compose.yml` | Create | dashboard-metrics + grafana-alloy services |
| `Backend/src/metrics/metrics.service.ts` | Create | prom-client registry, collectDefaultMetrics, HTTP Gauges |
| `Backend/src/metrics/metrics.middleware.ts` | Create | NestJS middleware counting requests + duration |
| `Backend/src/metrics/metrics.controller.ts` | Create | GET /metrics → registry.metrics() |
| `Backend/src/metrics/metrics.module.ts` | Create | Module wiring controller + middleware |
| `Backend/src/app.module.ts` | Modify | Import MetricsModule |
| `Frontend/instrumentation.ts` | Create | collectDefaultMetrics on server startup |
| `Frontend/lib/metrics.ts` | Create | prom-client register + HTTP counters |
| `Frontend/app/metrics/route.ts` | Create | GET /metrics (nodejs runtime) |
| `Frontend/app/api/proxy/[...path]/route.ts` | Modify | Increment proxy request counter + duration |

---

### Task 1: dashboard-metrics — project scaffold

**Files:**
- Create: `dashboard-metrics/package.json`
- Create: `dashboard-metrics/tsconfig.json`
- Create: `dashboard-metrics/Dockerfile`
- Create: `dashboard-metrics/.env.example`
- Create: `dashboard-metrics/src/config.ts`

**Interfaces:**
- Produces: `config` object consumed by Tasks 2, 3, 4

- [ ] **Step 1: Create `dashboard-metrics/package.json`**

```json
{
  "name": "dashboard-metrics",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@fastify/basic-auth": "^5.1.1",
    "fastify": "^4.28.1",
    "prom-client": "^15.1.3"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "bun-types": "latest",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create `dashboard-metrics/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `dashboard-metrics/Dockerfile`**

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY src/ ./src/
EXPOSE 9091
CMD ["bun", "src/index.ts"]
```

- [ ] **Step 4: Create `dashboard-metrics/.env.example`**

```env
# Server
PORT=9091

# /metrics Basic Auth (required)
METRICS_BASIC_AUTH_USER=metrics
METRICS_BASIC_AUTH_PASS=changeme

# Service probe URLs
FRONTEND_STATUS_URL=http://localhost:4000
BACKEND_STATUS_URL=http://localhost:3001

# Supabase (required)
SUPABASE_HEALTH_URL=https://<project-ref>.supabase.co/health
SUPABASE_ANON_KEY=your-anon-key-here

# Grafana Alloy remote_write (set in alloy container env, not here)
# GRAFANA_REMOTE_WRITE_URL=https://prometheus-prod-xx.grafana.net/api/prom/push
# GRAFANA_CLOUD_USER=123456
# GRAFANA_CLOUD_API_KEY=glc_xxx

# Alloy scrape targets (set in alloy container env)
# BACKEND_HOST=host.docker.internal:3001
# FRONTEND_HOST=host.docker.internal:4000
```

- [ ] **Step 5: Create `dashboard-metrics/src/config.ts`**

```ts
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  PORT: parseInt(process.env.PORT ?? "9091", 10),
  METRICS_BASIC_AUTH_USER: required("METRICS_BASIC_AUTH_USER"),
  METRICS_BASIC_AUTH_PASS: required("METRICS_BASIC_AUTH_PASS"),
  FRONTEND_STATUS_URL: process.env.FRONTEND_STATUS_URL ?? "http://localhost:4000",
  BACKEND_STATUS_URL: process.env.BACKEND_STATUS_URL ?? "http://localhost:3001",
  SUPABASE_HEALTH_URL: required("SUPABASE_HEALTH_URL"),
  SUPABASE_ANON_KEY: required("SUPABASE_ANON_KEY"),
} as const;
```

- [ ] **Step 6: Install dependencies**

```bash
cd dashboard-metrics
bun install
```

Expected: `node_modules/` created, `bun.lock` written

- [ ] **Step 7: Commit**

```bash
git add dashboard-metrics/
git commit -m "feat(dashboard-metrics): scaffold bun+fastify project"
```

---

### Task 2: dashboard-metrics — prom-client registry + metrics

**Files:**
- Create: `dashboard-metrics/src/metrics.ts`

**Interfaces:**
- Produces: `registry`, `serviceUp`, `serviceDegraded`, `serviceLatency` — consumed by Tasks 3, 4

- [ ] **Step 1: Create `dashboard-metrics/src/metrics.ts`**

```ts
import { Registry, Gauge } from "prom-client";

export const registry = new Registry();

export const serviceUp = new Gauge({
  name: "mangadock_service_up",
  help: "1 if service is up, 0 if down or degraded",
  labelNames: ["service"] as const,
  registers: [registry],
});

export const serviceDegraded = new Gauge({
  name: "mangadock_service_degraded",
  help: "1 if service is degraded (partial failure), 0 otherwise",
  labelNames: ["service"] as const,
  registers: [registry],
});

export const serviceLatency = new Gauge({
  name: "mangadock_service_latency_ms",
  help: "Last probe latency in ms; -1 if unreachable",
  labelNames: ["service"] as const,
  registers: [registry],
});

// Initialise all services to 0 so Grafana sees the series immediately
const SERVICES = ["frontend", "backend", "supabase", "cf-worker", "ai-gateway", "mit"] as const;
for (const s of SERVICES) {
  serviceUp.set({ service: s }, 0);
  serviceDegraded.set({ service: s }, 0);
  serviceLatency.set({ service: s }, -1);
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard-metrics/src/metrics.ts
git commit -m "feat(dashboard-metrics): add prom-client registry and service gauges"
```

---

### Task 3: dashboard-metrics — probe functions + tests

**Files:**
- Create: `dashboard-metrics/src/probes.ts`
- Create: `dashboard-metrics/src/probes.test.ts`

**Interfaces:**
- Consumes: `config` from `./config`, `serviceUp/serviceDegraded/serviceLatency` from `./metrics`
- Produces: `startProbeLoop(): void` — called by Task 4 in `src/index.ts`

- [ ] **Step 1: Write failing tests first — create `dashboard-metrics/src/probes.test.ts`**

```ts
import { describe, it, expect, afterEach } from "bun:test";

// Isolate config env before importing probes
process.env.METRICS_BASIC_AUTH_USER = "u";
process.env.METRICS_BASIC_AUTH_PASS = "p";
process.env.SUPABASE_HEALTH_URL = "https://test.supabase.co/health";
process.env.SUPABASE_ANON_KEY = "test-key";

const { probeStatusEndpoint, probeSupabase, probeCfWorker, probeMock } =
  await import("./probes");

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

// ── probeStatusEndpoint ───────────────────────────────────────────────────────

describe("probeStatusEndpoint", () => {
  it('maps status:"up" → up=true, degraded=false', async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ status: "up" }), { status: 200 }) as Response;
    const r = await probeStatusEndpoint("http://x/status");
    expect(r).toEqual({ up: true, degraded: false, latencyMs: expect.any(Number) });
  });

  it('maps status:"degraded" → up=false, degraded=true', async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ status: "degraded" }), { status: 200 }) as Response;
    const r = await probeStatusEndpoint("http://x/status");
    expect(r.up).toBe(false);
    expect(r.degraded).toBe(true);
  });

  it('maps status:"down" → up=false, degraded=false', async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ status: "down" }), { status: 200 }) as Response;
    const r = await probeStatusEndpoint("http://x/status");
    expect(r).toMatchObject({ up: false, degraded: false });
  });

  it("returns up=false, latencyMs=-1 on fetch throw", async () => {
    global.fetch = async () => { throw new Error("ECONNREFUSED"); };
    const r = await probeStatusEndpoint("http://x/status");
    expect(r).toEqual({ up: false, degraded: false, latencyMs: -1 });
  });

  it("returns up=false, latencyMs=-1 on non-200", async () => {
    global.fetch = async () => new Response("bad", { status: 502 }) as Response;
    const r = await probeStatusEndpoint("http://x/status");
    expect(r).toEqual({ up: false, degraded: false, latencyMs: -1 });
  });
});

// ── probeSupabase ─────────────────────────────────────────────────────────────

describe("probeSupabase", () => {
  it('returns up=true when status is "Healthy"', async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ status: "Healthy" }), { status: 200 }) as Response;
    const r = await probeSupabase();
    expect(r.up).toBe(true);
    expect(r.degraded).toBe(false);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns up=false for non-Healthy body", async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ status: "Unhealthy" }), { status: 200 }) as Response;
    expect((await probeSupabase()).up).toBe(false);
  });

  it("returns up=false, latencyMs=-1 on timeout/error", async () => {
    global.fetch = async () => { throw new Error("timeout"); };
    expect(await probeSupabase()).toEqual({ up: false, degraded: false, latencyMs: -1 });
  });
});

// ── probeCfWorker ─────────────────────────────────────────────────────────────

describe("probeCfWorker", () => {
  it("returns up=true for 2xx", async () => {
    global.fetch = async () => new Response("ok", { status: 200 }) as Response;
    expect((await probeCfWorker()).up).toBe(true);
  });

  it("returns up=true for 4xx (non-5xx = worker responded)", async () => {
    global.fetch = async () => new Response("not found", { status: 404 }) as Response;
    expect((await probeCfWorker()).up).toBe(true);
  });

  it("returns up=false for 5xx", async () => {
    global.fetch = async () => new Response("error", { status: 500 }) as Response;
    expect((await probeCfWorker()).up).toBe(false);
  });

  it("returns up=false, latencyMs=-1 on fetch error", async () => {
    global.fetch = async () => { throw new Error("ECONNREFUSED"); };
    expect(await probeCfWorker()).toEqual({ up: false, degraded: false, latencyMs: -1 });
  });
});

// ── probeMock ─────────────────────────────────────────────────────────────────

describe("probeMock", () => {
  it("always returns up=true, degraded=false, latencyMs=0", async () => {
    expect(await probeMock()()).toEqual({ up: true, degraded: false, latencyMs: 0 });
  });
});
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
cd dashboard-metrics
bun test src/probes.test.ts
```

Expected: FAIL — `Cannot find module './probes'`

- [ ] **Step 3: Create `dashboard-metrics/src/probes.ts`**

```ts
import { config } from "./config";
import { serviceUp, serviceDegraded, serviceLatency } from "./metrics";

const TIMEOUT_MS = 5000;

export interface ProbeResult {
  up: boolean;
  degraded: boolean;
  latencyMs: number;
}

export async function probeStatusEndpoint(url: string): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { up: false, degraded: false, latencyMs: -1 };
    const body = (await res.json()) as { status?: string };
    const s = body.status;
    return {
      up: s === "up",
      degraded: s === "degraded",
      latencyMs,
    };
  } catch {
    return { up: false, degraded: false, latencyMs: -1 };
  }
}

export async function probeSupabase(): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(config.SUPABASE_HEALTH_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { apikey: config.SUPABASE_ANON_KEY },
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { up: false, degraded: false, latencyMs: -1 };
    const body = (await res.json()) as { status?: string };
    return { up: body.status === "Healthy", degraded: false, latencyMs };
  } catch {
    return { up: false, degraded: false, latencyMs: -1 };
  }
}

export async function probeCfWorker(): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://assets.2552667.xyz/health", {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latencyMs = Date.now() - t0;
    return { up: res.status < 500, degraded: false, latencyMs };
  } catch {
    return { up: false, degraded: false, latencyMs: -1 };
  }
}

export function probeMock(): () => Promise<ProbeResult> {
  return async () => ({ up: true, degraded: false, latencyMs: 0 });
}

const SERVICES: Array<{ name: string; probe: () => Promise<ProbeResult> }> = [
  { name: "frontend",   probe: () => probeStatusEndpoint(`${config.FRONTEND_STATUS_URL}/status`) },
  { name: "backend",    probe: () => probeStatusEndpoint(`${config.BACKEND_STATUS_URL}/status`) },
  { name: "supabase",   probe: probeSupabase },
  { name: "cf-worker",  probe: probeCfWorker },
  { name: "ai-gateway", probe: probeMock() },
  { name: "mit",        probe: probeMock() },
];

export function startProbeLoop(): void {
  async function tick() {
    await Promise.allSettled(
      SERVICES.map(async ({ name, probe }) => {
        const r = await probe();
        serviceUp.set({ service: name }, r.up ? 1 : 0);
        serviceDegraded.set({ service: name }, r.degraded ? 1 : 0);
        serviceLatency.set({ service: name }, r.latencyMs);
      }),
    );
  }
  tick();
  setInterval(tick, 15_000);
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
cd dashboard-metrics
bun test src/probes.test.ts
```

Expected: PASS — 12 tests green

- [ ] **Step 5: Commit**

```bash
git add dashboard-metrics/src/probes.ts dashboard-metrics/src/probes.test.ts
git commit -m "feat(dashboard-metrics): add probe functions and bun:test suite"
```

---

### Task 4: dashboard-metrics — Fastify server (/health + /metrics + probe loop)

**Files:**
- Create: `dashboard-metrics/src/index.ts`

**Interfaces:**
- Consumes: `config` from `./config`; `registry` from `./metrics`; `startProbeLoop` from `./probes`
- Produces: HTTP server on `config.PORT` — `/health` (open) and `/metrics` (Basic auth)

- [ ] **Step 1: Create `dashboard-metrics/src/index.ts`**

```ts
import Fastify from "fastify";
import basicAuth from "@fastify/basic-auth";
import { config } from "./config";
import { registry } from "./metrics";
import { startProbeLoop } from "./probes";

const fastify = Fastify({ logger: true });

await fastify.register(basicAuth, {
  validate: async (username, password, _req, _reply) => {
    if (
      username !== config.METRICS_BASIC_AUTH_USER ||
      password !== config.METRICS_BASIC_AUTH_PASS
    ) {
      return new Error("Unauthorized");
    }
  },
  authenticate: true,
});

fastify.get("/health", async () => ({
  status: "ok",
  uptime: Math.floor(process.uptime()),
}));

fastify.get(
  "/metrics",
  { onRequest: fastify.basicAuth },
  async (_req, reply) => {
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  },
);

startProbeLoop();

await fastify.listen({ port: config.PORT, host: "0.0.0.0" });
```

- [ ] **Step 2: Create a local `.env` for smoke-testing**

```bash
cat > dashboard-metrics/.env << 'EOF'
METRICS_BASIC_AUTH_USER=metrics
METRICS_BASIC_AUTH_PASS=secret
SUPABASE_HEALTH_URL=https://example.supabase.co/health
SUPABASE_ANON_KEY=dummy
EOF
```

- [ ] **Step 3: Smoke-test /health**

```bash
cd dashboard-metrics
bun src/index.ts &
sleep 2
curl -s http://localhost:9091/health
```

Expected: `{"status":"ok","uptime":1}` (or similar)

- [ ] **Step 4: Smoke-test /metrics auth**

```bash
# Should return 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:9091/metrics
# Should return metrics
curl -s -u metrics:secret http://localhost:9091/metrics | head -20
```

Expected first: `401`. Expected second: lines starting with `# HELP mangadock_service_up`

- [ ] **Step 5: Stop background server and remove local .env**

```bash
kill %1
rm dashboard-metrics/.env
```

- [ ] **Step 6: Commit**

```bash
git add dashboard-metrics/src/index.ts
git commit -m "feat(dashboard-metrics): add fastify server with /health and /metrics"
```

---

### Task 5: Infrastructure — docker-compose + Grafana Alloy config

**Files:**
- Create: `docker-compose.yml` (repo root)
- Create: `dashboard-metrics/alloy/config.alloy`

**Interfaces:**
- Consumes: `dashboard-metrics` image built from `./dashboard-metrics`
- Produces: `docker compose up` starts both services; Alloy pushes metrics to Grafana Cloud

- [ ] **Step 1: Create `dashboard-metrics/alloy/config.alloy`**

```alloy
prometheus.scrape "dashboard_metrics" {
  targets         = [{ __address__ = "dashboard-metrics:9091" }]
  metrics_path    = "/metrics"
  scrape_interval = "15s"
  scrape_timeout  = "5s"
  basic_auth {
    username = env("METRICS_BASIC_AUTH_USER")
    password = env("METRICS_BASIC_AUTH_PASS")
  }
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.scrape "backend" {
  targets         = [{ __address__ = env("BACKEND_HOST") }]
  metrics_path    = "/metrics"
  scrape_interval = "15s"
  scrape_timeout  = "5s"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.scrape "frontend" {
  targets         = [{ __address__ = env("FRONTEND_HOST") }]
  metrics_path    = "/metrics"
  scrape_interval = "15s"
  scrape_timeout  = "5s"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_REMOTE_WRITE_URL")
    basic_auth {
      username = env("GRAFANA_CLOUD_USER")
      password = env("GRAFANA_CLOUD_API_KEY")
    }
  }
}
```

- [ ] **Step 2: Create `docker-compose.yml` at repo root**

```yaml
services:
  dashboard-metrics:
    build: ./dashboard-metrics
    ports:
      - "9091:9091"
    env_file: ./dashboard-metrics/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9091/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  grafana-alloy:
    image: grafana/alloy:latest
    volumes:
      - ./dashboard-metrics/alloy/config.alloy:/etc/alloy/config.alloy:ro
    command: run /etc/alloy/config.alloy
    restart: unless-stopped
    depends_on:
      dashboard-metrics:
        condition: service_healthy
    environment:
      - METRICS_BASIC_AUTH_USER=${METRICS_BASIC_AUTH_USER}
      - METRICS_BASIC_AUTH_PASS=${METRICS_BASIC_AUTH_PASS}
      - GRAFANA_REMOTE_WRITE_URL=${GRAFANA_REMOTE_WRITE_URL}
      - GRAFANA_CLOUD_USER=${GRAFANA_CLOUD_USER}
      - GRAFANA_CLOUD_API_KEY=${GRAFANA_CLOUD_API_KEY}
      - BACKEND_HOST=${BACKEND_HOST:-host.docker.internal:3001}
      - FRONTEND_HOST=${FRONTEND_HOST:-host.docker.internal:4000}
```

- [ ] **Step 3: Add `.env` to root `.gitignore` if not already there**

```bash
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
```

- [ ] **Step 4: Smoke-test docker compose build**

```bash
# Create a minimal .env at repo root for local test (do NOT commit)
cat > .env << 'EOF'
METRICS_BASIC_AUTH_USER=metrics
METRICS_BASIC_AUTH_PASS=secret
SUPABASE_HEALTH_URL=https://example.supabase.co/health
SUPABASE_ANON_KEY=dummy
GRAFANA_REMOTE_WRITE_URL=https://placeholder.grafana.net/api/prom/push
GRAFANA_CLOUD_USER=0
GRAFANA_CLOUD_API_KEY=dummy
EOF
docker compose build dashboard-metrics
```

Expected: build succeeds, image tagged `mangadock-dashboard-metrics`

- [ ] **Step 5: Verify dashboard-metrics container starts and /health responds**

```bash
docker compose up dashboard-metrics -d
sleep 5
curl -s http://localhost:9091/health
docker compose down
```

Expected: `{"status":"ok","uptime":...}`

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml dashboard-metrics/alloy/config.alloy
git commit -m "feat(infra): add docker-compose with dashboard-metrics + grafana-alloy"
```

---

### Task 6: Backend — prom-client instrumentation + GET /metrics

**Files:**
- Create: `Backend/src/metrics/metrics.service.ts`
- Create: `Backend/src/metrics/metrics.middleware.ts`
- Create: `Backend/src/metrics/metrics.controller.ts`
- Create: `Backend/src/metrics/metrics.module.ts`
- Modify: `Backend/src/app.module.ts`

**Interfaces:**
- Produces: `GET /metrics` on Backend port 3001 — Prometheus text format with process + HTTP metrics

- [ ] **Step 1: Install prom-client in Backend**

```bash
cd Backend
npm install prom-client
```

Expected: `prom-client` added to `package.json` dependencies

- [ ] **Step 2: Create `Backend/src/metrics/metrics.service.ts`**

```ts
import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'mangadock_' });

export const httpRequestsTotal = new Counter({
  name: 'mangadock_http_requests_total',
  help: 'Total HTTP requests to Backend',
  labelNames: ['service', 'method', 'route', 'status_code'] as const,
});

export const httpRequestDuration = new Histogram({
  name: 'mangadock_http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['service', 'method', 'route'] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export { register };
```

- [ ] **Step 3: Create `Backend/src/metrics/metrics.middleware.ts`**

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const t0 = Date.now();
    const { method } = req;

    res.on('finish', () => {
      // Normalise dynamic segments to reduce cardinality
      const route = (req.route?.path as string | undefined)
        ?? req.path.replace(/\/[0-9a-f-]{8,}/g, '/:id').replace(/\/\d+/g, '/:id');
      const duration = Date.now() - t0;
      httpRequestsTotal.inc({
        service: 'backend',
        method,
        route,
        status_code: String(res.statusCode),
      });
      httpRequestDuration.observe({ service: 'backend', method, route }, duration);
    });

    next();
  }
}
```

- [ ] **Step 4: Create `Backend/src/metrics/metrics.controller.ts`**

```ts
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { register } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}
```

- [ ] **Step 5: Create `Backend/src/metrics/metrics.module.ts`**

```ts
import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';

@Module({ controllers: [MetricsController] })
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsMiddleware)
      .exclude({ path: 'metrics', method: RequestMethod.GET })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
```

- [ ] **Step 6: Add MetricsModule to `Backend/src/app.module.ts`**

Add `import { MetricsModule } from './metrics/metrics.module';` after the existing imports.

Add `MetricsModule,` to the `imports` array (after `ForumModule`):

```ts
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    SupabaseModule,
    StorageModule,
    CacheModule,
    BooksModule,
    UsersModule,
    StatusModule,
    VersionsModule,
    UploadModule,
    WalletModule,
    UnlockModule,
    ForumModule,
    MetricsModule,
  ],
})
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd Backend
npm run build
```

Expected: no TypeScript errors, `dist/` updated

- [ ] **Step 8: Smoke-test GET /metrics** (Backend must be running)

```bash
cd Backend
npm run start:dev &
sleep 5
curl -s http://localhost:3001/metrics | grep mangadock_
```

Expected: lines like `mangadock_process_cpu_seconds_total`, `mangadock_http_requests_total`

- [ ] **Step 9: Run Backend test suite**

```bash
cd Backend
npm test -- --passWithNoTests
```

Expected: existing tests still green (MetricsModule adds no breaking changes)

- [ ] **Step 10: Commit**

```bash
cd Backend
git add src/metrics/ src/app.module.ts package.json package-lock.json
git commit -m "feat(backend): add prom-client instrumentation and GET /metrics endpoint"
```

---

### Task 7: Frontend — prom-client instrumentation + GET /metrics

**Files:**
- Create: `Frontend/instrumentation.ts`
- Create: `Frontend/lib/metrics.ts`
- Create: `Frontend/app/metrics/route.ts`
- Modify: `Frontend/app/api/proxy/[...path]/route.ts`

**Interfaces:**
- Produces: `GET /metrics` on Frontend port 4000 — process metrics + proxy request counters

- [ ] **Step 1: Install prom-client in Frontend**

```bash
cd Frontend
bun add prom-client
```

Expected: `prom-client` added to `Frontend/package.json`

- [ ] **Step 2: Create `Frontend/instrumentation.ts`**

This file runs once on server startup (Node.js runtime only):

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { collectDefaultMetrics } = await import("prom-client");
    collectDefaultMetrics({ prefix: "mangadock_frontend_" });
  }
}
```

- [ ] **Step 3: Create `Frontend/lib/metrics.ts`**

```ts
import { Counter, Histogram, register } from "prom-client";

export const proxyRequestsTotal = new Counter({
  name: "mangadock_http_requests_total",
  help: "Total HTTP requests proxied by Frontend",
  labelNames: ["service", "method", "status_code"] as const,
});

export const proxyRequestDuration = new Histogram({
  name: "mangadock_http_request_duration_ms",
  help: "HTTP proxy request duration in ms",
  labelNames: ["service", "method"] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export { register };
```

- [ ] **Step 4: Create `Frontend/app/metrics/route.ts`**

```ts
export const runtime = "nodejs";

import { register } from "@/lib/metrics";

export async function GET() {
  return new Response(await register.metrics(), {
    headers: { "Content-Type": register.contentType },
  });
}
```

- [ ] **Step 5: Modify `Frontend/app/api/proxy/[...path]/route.ts`**

Add these imports after the existing import line:
```ts
import { proxyRequestsTotal, proxyRequestDuration } from "@/lib/metrics";
```

Wrap the `try` block in `handler` to record timing. Replace the existing `try { const upstream = await fetch(...)` block with:

```ts
  const t0 = Date.now();
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      signal: req.signal,
      // @ts-expect-error Node 18+ fetch supports duplex
      duplex: body ? "half" : undefined,
    });

    proxyRequestsTotal.inc({
      service: "frontend",
      method: req.method,
      status_code: String(upstream.status),
    });
    proxyRequestDuration.observe({ service: "frontend", method: req.method }, Date.now() - t0);

    const resHeaders = new Headers();
    for (const [key, value] of upstream.headers.entries()) {
      if (["transfer-encoding", "connection"].includes(key.toLowerCase())) continue;
      resHeaders.set(key, value);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    proxyRequestsTotal.inc({ service: "frontend", method: req.method, status_code: "502" });
    console.error(`[ProxyError] Failed to fetch from backend: ${url}`, err);
    return NextResponse.json(
      { ok: false, error: "Backend unreachable", details: errMessage(err) },
      { status: 502 },
    );
  }
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd Frontend
bun build 2>&1 | head -30
```

Expected: no TypeScript errors

- [ ] **Step 7: Smoke-test GET /metrics** (Frontend must be running)

```bash
cd Frontend
bun dev &
sleep 8
curl -s http://localhost:4000/metrics | grep mangadock_
```

Expected: lines like `mangadock_frontend_process_cpu_seconds_total`, `mangadock_http_requests_total`

- [ ] **Step 8: Stop dev server**

```bash
kill %1
```

- [ ] **Step 9: Commit**

```bash
cd Frontend
git add instrumentation.ts lib/metrics.ts app/metrics/route.ts app/api/proxy/
git commit -m "feat(frontend): add prom-client instrumentation and GET /metrics endpoint"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `dashboard-metrics/` at repo root, Fastify + prom-client | Tasks 1–4 |
| Port 9091 | Task 1 (`config.ts`), Task 5 (docker-compose) |
| 3 Gauges: up, degraded, latency_ms | Task 2 |
| `mangadock_` prefix | Tasks 2, 6, 7 |
| 6 service probes with correct logic | Task 3 |
| Supabase: apikey header + "Healthy" check | Task 3 (`probeSupabase`) |
| CF Worker: `https://assets.2552667.xyz/health`, non-5xx = up | Task 3 (`probeCfWorker`) |
| AI Gateway + MIT: mock stubs | Task 3 (`probeMock`) |
| Probe interval 15s, timeout 5s | Task 3 (`TIMEOUT_MS`, `setInterval`) |
| Status mapping: up/degraded/down → Gauge values | Task 3 (`probeStatusEndpoint`) |
| Basic auth on /metrics | Task 4 |
| /health open, returns uptime | Task 4 |
| docker-compose at repo root | Task 5 |
| Grafana Alloy config scraping 3 targets | Task 5 |
| Alloy remote_write to Grafana Cloud | Task 5 |
| Backend: collectDefaultMetrics + HTTP counter + histogram | Task 6 |
| Backend: GET /metrics, no auth guard | Task 6 |
| Frontend: collectDefaultMetrics via instrumentation.ts | Task 7 |
| Frontend: GET /metrics, nodejs runtime | Task 7 |
| Frontend: proxy request counter + duration | Task 7 |

**Placeholder scan:** None — all steps contain runnable code and exact commands.

**Type consistency:**
- `ProbeResult { up, degraded, latencyMs }` defined Task 3, used Task 3 only ✓
- `config` defined Task 1, imported in Tasks 3, 4 ✓
- `registry` defined Task 2, imported Task 4 ✓
- `serviceUp/serviceDegraded/serviceLatency` defined Task 2, used Task 3 ✓
- `startProbeLoop` defined Task 3, called Task 4 ✓
- `register` exported Task 6 `metrics.service.ts`, imported Task 6 `metrics.controller.ts` ✓
- `httpRequestsTotal/httpRequestDuration` exported Task 6 `metrics.service.ts`, imported Task 6 `metrics.middleware.ts` ✓
- `proxyRequestsTotal/proxyRequestDuration` exported Task 7 `lib/metrics.ts`, imported Task 7 `route.ts` ✓

**Out of scope (separate follow-up):**
- `dashboardv2/` removal — do after verifying Grafana Cloud receives metrics for 24–48h (Phase 3 in spec)
