# Redis Exporter Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock Redis probe in dashboard-metrics with `probeRedisExporter()` that checks `redis_up` from `oliver006/redis_exporter`, and add the exporter as a docker-compose sidecar scraped by Alloy.

**Architecture:** `redis_exporter` runs as a compose sidecar (port 9121); Alloy scrapes it directly for rich Redis metrics. `dashboard-metrics` separately fetches `/metrics` from the exporter, parses `redis_up` with a regex, and produces a `ProbeResult` for the health card UI — no Redis client needed.

**Tech Stack:** Bun, bun:test, fetch (built-in), `oliver006/redis_exporter:latest`, Grafana Alloy

## Global Constraints

- Test runner: `bun test` from `dashboard-metrics/` — uses `bun:test`, not Jest
- Mock `global.fetch` for unit tests (pattern already in `probes.test.ts`)
- `probeRedisExporter` is a plain `async function` (not a factory), consistent with `probeStatusEndpoint` / `probeSupabase` patterns
- Timeout constant: 3000 ms (separate from the existing `TIMEOUT_MS = 5000` for other probes)
- Degraded threshold: `latencyMs > 200`
- `redis_up` parse: regex `/^redis_up\s+1(\s|$)/m` (multiline, avoids matching `redis_up 10`)

---

### Task 1: `probeRedisExporter` — function, tests, config, SERVICES wire

**Files:**
- Modify: `dashboard-metrics/src/config.ts` (add `REDIS_EXPORTER_URL`)
- Modify: `dashboard-metrics/src/probes.ts` (add `probeRedisExporter`; replace `probeMock()` at redis line)
- Modify: `dashboard-metrics/src/probes.test.ts` (add import + 4 unit tests)

**Interfaces:**
- Produces: `export async function probeRedisExporter(exporterUrl: string): Promise<ProbeResult>`
- Produces: `config.REDIS_EXPORTER_URL: string`

- [ ] **Step 1: Write the 4 failing unit tests**

Add at the bottom of `dashboard-metrics/src/probes.test.ts`:

First, update the existing import line at the top to include `probeRedisExporter`:
```ts
const { probeStatusEndpoint, probeSupabase, probeCfWorker, probeMock, probeRedisExporter } =
  await import("./probes");
```

Then add at the end of the file:
```ts
// ── probeRedisExporter ────────────────────────────────────────────────────────

describe("probeRedisExporter", () => {
  it("returns up=true when redis_up 1 found in metrics response", async () => {
    global.fetch = async () =>
      new Response("# HELP redis_up Redis up\n# TYPE redis_up gauge\nredis_up 1\n", {
        status: 200,
      }) as Response;
    const r = await probeRedisExporter("http://redis-exporter:9121");
    expect(r.up).toBe(true);
    expect(r.degraded).toBe(false);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns up=false when redis_up 0 found (exporter reachable, Redis down)", async () => {
    global.fetch = async () =>
      new Response("redis_up 0\n", { status: 200 }) as Response;
    const r = await probeRedisExporter("http://redis-exporter:9121");
    expect(r.up).toBe(false);
    expect(r.degraded).toBe(false);
  });

  it("returns up=false, latencyMs=-1 on fetch throw", async () => {
    global.fetch = async () => { throw new Error("ECONNREFUSED"); };
    const r = await probeRedisExporter("http://redis-exporter:9121");
    expect(r).toEqual({ up: false, degraded: false, latencyMs: -1 });
  });

  it("returns up=false, latencyMs=-1 on non-200 response", async () => {
    global.fetch = async () => new Response("bad gateway", { status: 502 }) as Response;
    const r = await probeRedisExporter("http://redis-exporter:9121");
    expect(r).toEqual({ up: false, degraded: false, latencyMs: -1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd dashboard-metrics && bun test src/probes.test.ts
```

Expected: FAIL — `probeRedisExporter is not a function`

- [ ] **Step 3: Add `REDIS_EXPORTER_URL` to config**

Edit `dashboard-metrics/src/config.ts` — add one line before `} as const;`:

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
  REDIS_EXPORTER_URL: process.env.REDIS_EXPORTER_URL ?? "http://redis-exporter:9121",
} as const;
```

- [ ] **Step 4: Add `probeRedisExporter` to `probes.ts` and wire into SERVICES**

In `dashboard-metrics/src/probes.ts`:

1. Add the constant and function after `probeMock` (around line 62):

```ts
const REDIS_PROBE_TIMEOUT_MS = 3000;

export async function probeRedisExporter(exporterUrl: string): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${exporterUrl}/metrics`, {
      signal: AbortSignal.timeout(REDIS_PROBE_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { up: false, degraded: false, latencyMs: -1 };
    const text = await res.text();
    const up = /^redis_up\s+1(\s|$)/m.test(text);
    return { up, degraded: up && latencyMs > 200, latencyMs };
  } catch {
    return { up: false, degraded: false, latencyMs: -1 };
  }
}
```

2. Replace the redis entry in `SERVICES` (line 72):

```ts
// Before:
{ name: "redis", probe: probeMock() },

// After:
{ name: "redis", probe: () => probeRedisExporter(config.REDIS_EXPORTER_URL) },
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd dashboard-metrics && bun test src/probes.test.ts
```

Expected: All tests pass including the 4 new `probeRedisExporter` tests.

- [ ] **Step 6: Commit**

```bash
git add dashboard-metrics/src/config.ts dashboard-metrics/src/probes.ts dashboard-metrics/src/probes.test.ts
git commit -m "feat(dashboard-metrics): add probeRedisExporter; replace redis mock probe"
```

---

### Task 2: Infrastructure — docker-compose, Alloy config, .env.example

**Files:**
- Modify: `docker-compose.yml` (add `redis-exporter` service)
- Modify: `dashboard-metrics/alloy/config.alloy` (add redis_exporter scrape block)
- Modify: `dashboard-metrics/.env.example` (document `REDIS_EXPORTER_URL` and `REDIS_ADDR`)

**Interfaces:**
- Consumes: `redis-exporter` container name on the compose network (used by Alloy scrape target and by `dashboard-metrics` probe default URL)

- [ ] **Step 1: Add `redis-exporter` service to `docker-compose.yml`**

Add after the `dashboard-metrics` service block, before `grafana-alloy`:

```yaml
  redis-exporter:
    image: oliver006/redis_exporter:latest
    environment:
      - REDIS_ADDR=${REDIS_ADDR:-redis://host.docker.internal:6379}
    restart: unless-stopped
```

The full updated `docker-compose.yml`:

```yaml
version: '3.9'

services:
  # redis: (commented out)

  dashboard-metrics:
    build: ./dashboard-metrics
    ports:
      - "9091:9091"
    env_file: ./dashboard-metrics/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "bun -e \"fetch('http://localhost:9091/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s

  redis-exporter:
    image: oliver006/redis_exporter:latest
    environment:
      - REDIS_ADDR=${REDIS_ADDR:-redis://host.docker.internal:6379}
    restart: unless-stopped

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

volumes:
  redis_data:
```

- [ ] **Step 2: Add redis_exporter scrape block to `alloy/config.alloy`**

Append after the `prometheus.scrape "frontend"` block:

```alloy
prometheus.scrape "redis_exporter" {
  targets         = [{ __address__ = "redis-exporter:9121" }]
  metrics_path    = "/metrics"
  scrape_interval = "15s"
  scrape_timeout  = "5s"
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}
```

Full updated `dashboard-metrics/alloy/config.alloy`:

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

prometheus.scrape "redis_exporter" {
  targets         = [{ __address__ = "redis-exporter:9121" }]
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

- [ ] **Step 3: Update `.env.example`**

Add after the `SUPABASE_ANON_KEY` line:

```env
# Redis Exporter probe target (dashboard-metrics reads this to know where to check redis_up)
REDIS_EXPORTER_URL=http://redis-exporter:9121

# Redis address for the redis-exporter container (set in shell env or top-level .env for docker-compose)
# REDIS_ADDR=redis://host.docker.internal:6379
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml dashboard-metrics/alloy/config.alloy dashboard-metrics/.env.example
git commit -m "feat(infra): add redis-exporter sidecar; wire Alloy scrape for Redis metrics"
```
