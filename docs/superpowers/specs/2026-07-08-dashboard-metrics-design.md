# Design: dashboard-metrics — Prometheus Exporter + Grafana Cloud

**Date:** 2026-07-08  
**Status:** Approved  
**Replaces:** dashboardv2 (Next.js MIT Staff Console)

---

## Overview

Replace `dashboardv2` with a lightweight standalone Fastify service (`dashboard-metrics`) that probes 6 services, exposes Prometheus metrics at `/metrics`, and pushes to Grafana Cloud via Grafana Alloy. Backend and Frontend are also instrumented with `prom-client` to expose CPU, RAM, event loop, and HTTP request metrics.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  docker-compose.yml (repo root)                                  │
│                                                                  │
│  ┌──────────────────┐                      ┌─────────────────┐  │
│  │ dashboard-metrics│◄──scrape :9091/metrics│  Grafana Alloy  │  │
│  │  Fastify :9091   │      (Basic auth)     │                 │──┼──remote_write──► Grafana Cloud
│  │  /health (open)  │                       │ scrape :3001    │  │
│  │  /metrics (auth) │    ┌──────────────────┤   /metrics      │  │
│  └────────┬─────────┘    │ Backend (NestJS) │ scrape :4000    │  │
└───────────┼──────────────┼──────────────────┤   /metrics      │  │
            │              │ Frontend (Next.js)└─────────────────┘  │
            │ probe every 15s (timeout 5s)                          │
            ▼                                                        │
  ┌─────────────────────────────────────────────────┐               │
  │ Frontend  :4000/status    → up/degraded/down    │               │
  │ Backend   :3001/status    → up/degraded/down    │               │
  │ Supabase  cloud/health    → Healthy / else down │               │
  │ CF Worker assets.2552667  → non-5xx = up        │               │
  │ AI Gateway                → mock stub           │               │
  │ MIT                       → mock stub           │               │
  └─────────────────────────────────────────────────┘
```

**Grafana Alloy scrapes 3 endpoints:**
- `dashboard-metrics:9091/metrics` — service health (up/degraded/down ทุก service)
- `backend:3001/metrics` — CPU, RAM, req rate, p99, error rate
- `frontend:4000/metrics` — CPU, RAM, req rate, p99, error rate

---

## File Structure

```
dashboard-metrics/
├── src/
│   ├── index.ts          # Fastify server, /health, /metrics routes
│   ├── probes.ts         # probe functions (1 ต่อ service)
│   ├── metrics.ts        # prom-client registry + Gauge definitions
│   └── config.ts         # env vars + probe config per service
├── alloy/
│   └── config.alloy      # Grafana Alloy scrape + remote_write config
├── .env.example
├── package.json
├── tsconfig.json
└── Dockerfile

docker-compose.yml        # repo root — dashboard-metrics + grafana-alloy
```

---

## Metrics Schema

### Service Health (dashboard-metrics probe)

```
mangadock_service_up{service}         # 1=up, 0=down
mangadock_service_degraded{service}   # 1=degraded, 0=ไม่ degraded
mangadock_service_latency_ms{service} # ms, -1 ถ้า unreachable
```

`service` label values: `frontend`, `backend`, `supabase`, `cf-worker`, `ai-gateway`, `mit`

### Process Metrics (Backend + Frontend via prom-client collectDefaultMetrics)

```
process_cpu_seconds_total             → rate() * 100 = CPU %
process_resident_memory_bytes         → RSS (MB)
nodejs_heap_size_used_bytes           → Heap used (MB)
nodejs_heap_size_total_bytes          → Heap total (MB)
nodejs_external_memory_bytes          → External memory
nodejs_eventloop_lag_seconds          → Event loop lag
nodejs_eventloop_lag_p99_seconds      → p99 lag
nodejs_gc_pause_seconds_total         → GC pause time
nodejs_active_handles_total           → Open handles
nodejs_active_requests_total          → In-flight requests
```

### HTTP Metrics (Backend + Frontend middleware)

```
mangadock_http_requests_total{service, method, route, status_code}
mangadock_http_request_duration_ms{service, method, route, quantile}
```

### Grafana Queries

```promql
rate(process_cpu_seconds_total[1m]) * 100                           # CPU %
nodejs_heap_size_used_bytes / 1024 / 1024                           # Heap MB
rate(mangadock_http_requests_total[1m]) * 60                        # req/min
rate(mangadock_http_requests_total[1m])                             # req/sec
increase(mangadock_http_requests_total[1h])                         # req/hour
histogram_quantile(0.99, rate(mangadock_http_request_duration_ms_bucket[5m])) # p99
rate(mangadock_http_requests_total{status_code=~"5.."}[1m])
  / rate(mangadock_http_requests_total[1m]) * 100                   # error rate %
```

---

## Probe Logic

| Service | Method | Endpoint | up condition | degraded |
|---|---|---|---|---|
| Frontend | GET | `FRONTEND_STATUS_URL/status` | `status:"up"` | `status:"degraded"` |
| Backend | GET | `BACKEND_STATUS_URL/status` | `status:"up"` | `status:"degraded"` |
| Supabase | GET + `apikey` header | `SUPABASE_HEALTH_URL` | `status:"Healthy"` | — (down เลย) |
| CF Worker | GET | `https://assets.2552667.xyz/health` | non-5xx | — (down เลย) |
| AI Gateway | mock | — | hardcode `up` | — |
| MIT | mock | — | hardcode `up` | — |

**Error handling:**
- timeout (5s) → `up=0`, `degraded=0`, `latency_ms=-1`
- 5xx จาก CF Worker → `down`
- network exception → `down`
- stale metrics คงค่าเดิมจนกว่า probe ครั้งถัดไปจะสำเร็จ

---

## Probe Loop (src/probes.ts)

```ts
const SERVICES = [
  { name: "frontend",   probe: probeFrontend },
  { name: "backend",    probe: probeBackend },
  { name: "supabase",   probe: probeSupabase },
  { name: "cf-worker",  probe: probeCfWorker },
  { name: "ai-gateway", probe: probeMock("up") },
  { name: "mit",        probe: probeMock("up") },
];

export function startProbeLoop() {
  async function tick() {
    await Promise.allSettled(SERVICES.map(async ({ name, probe }) => {
      const result = await probe();
      serviceUp.set({ service: name }, result.up ? 1 : 0);
      serviceDegraded.set({ service: name }, result.degraded ? 1 : 0);
      serviceLatency.set({ service: name }, result.latencyMs);
    }));
  }
  tick();
  setInterval(tick, 15_000);
}
```

---

## docker-compose.yml (repo root)

```yaml
services:
  dashboard-metrics:
    build: ./dashboard-metrics
    ports:
      - "9091:9091"
    env_file: ./dashboard-metrics/.env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9091/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  grafana-alloy:
    image: grafana/alloy:latest
    volumes:
      - ./dashboard-metrics/alloy/config.alloy:/etc/alloy/config.alloy
    command: run /etc/alloy/config.alloy
    depends_on:
      dashboard-metrics:
        condition: service_healthy
```

---

## Grafana Alloy Config (dashboard-metrics/alloy/config.alloy)

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

---

## Environment Variables (dashboard-metrics/.env.example)

```env
# Server
PORT=9091

# /metrics Basic Auth
METRICS_BASIC_AUTH_USER=metrics
METRICS_BASIC_AUTH_PASS=changeme

# Service probe URLs
FRONTEND_STATUS_URL=http://localhost:4000
BACKEND_STATUS_URL=http://localhost:3001

# Supabase
SUPABASE_HEALTH_URL=https://<project>.supabase.co/health
SUPABASE_ANON_KEY=your-anon-key

# Grafana Alloy (ใส่ใน env ของ Alloy container)
GRAFANA_REMOTE_WRITE_URL=https://prometheus-prod-xx.grafana.net/api/prom/push
GRAFANA_CLOUD_USER=123456
GRAFANA_CLOUD_API_KEY=your-api-key

# Alloy scrape targets
BACKEND_HOST=host.docker.internal:3001
FRONTEND_HOST=host.docker.internal:4000
```

**Security:** `SUPABASE_ANON_KEY`, `GRAFANA_CLOUD_API_KEY`, `METRICS_BASIC_AUTH_PASS` ต้องอยู่ใน `.env` เท่านั้น — ห้าม commit ลง git (เพิ่มใน `.gitignore`)

---

## Rollout Plan

### Phase 1 — Build dashboard-metrics
- สร้าง `dashboard-metrics/` Fastify app
- instrument Backend `/metrics` (prom-client + HTTP middleware)
- instrument Frontend `/metrics` (prom-client + middleware.ts)
- `docker compose up` ทดสอบ local
- verify Grafana Cloud รับ metrics ได้

### Phase 2 — Verify in Production
- deploy dashboard-metrics
- monitor Grafana Cloud 24–48h ว่า metrics ไหลสม่ำเสมอ
- สร้าง Grafana dashboard และ alert พื้นฐาน

### Phase 3 — Remove dashboardv2
- `git rm -r dashboardv2/`
- commit: `chore: remove dashboardv2 (replaced by dashboard-metrics + Grafana Cloud)`

---

## Reuse from dashboardv2

- `dashboardv2/lib/service-status.ts` → copy `probeService()` logic มาใช้ใน `dashboard-metrics/src/probes.ts`
- `dashboardv2/lib/service-status.test.ts` → copy test cases ปรับสำหรับ Fastify context

---

## Non-goals

- Alertmanager หรือ PagerDuty integration (Grafana Cloud alerting เพียงพอ)
- Tracing (OpenTelemetry) — ไม่อยู่ใน scope นี้
- Log aggregation (Loki) — ไม่อยู่ใน scope นี้
- Per-endpoint breakdown สำหรับ Supabase/Cloudflare — online check เพียงพอ
