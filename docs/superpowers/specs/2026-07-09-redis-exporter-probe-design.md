# Redis Exporter Probe Design

**Date:** 2026-07-09
**Scope:** dashboard-metrics + docker-compose + Alloy config
**Goal:** Replace the mock Redis probe with a real health check via `redis_exporter`, giving Grafana Cloud rich Redis metrics while keeping the dashboard-metrics health card accurate.

---

## Architecture

```
Redis ←── oliver006/redis_exporter (port 9121) ──→ /metrics (Prometheus format)
                         ↑                                  ↑
          dashboard-metrics probe:              Grafana Alloy scrapes & pushes
          fetch /metrics, parse redis_up         to Grafana Cloud
          → ProbeResult for health card UI
```

`redis_exporter` runs as a docker-compose sidecar. Alloy scrapes it directly on port 9121. `dashboard-metrics` also probes it — not to forward metrics, but solely to determine `up/degraded` status for the `/metrics` health card and dashboardv2 UI.

---

## Services

### `redis-exporter` (new docker-compose service)

- Image: `oliver006/redis_exporter:latest`
- Port: `9121` (internal only — not published to host)
- Env: `REDIS_ADDR` — address of the Redis instance (e.g. `redis://host.docker.internal:6379`)
- No authentication required for the exporter's `/metrics` endpoint (scrape is internal to the compose network)

### Alloy (updated config)

Add a new `prometheus.scrape "redis_exporter"` block:
- Target: `redis-exporter:9121`
- Path: `/metrics`
- Interval: `15s`, timeout `5s`
- No basic auth (exporter is unauthenticated)
- Forward to `prometheus.remote_write.grafana_cloud.receiver`

### `dashboard-metrics` (probe replacement)

Replace `probeMock()` for the `redis` entry with `probeRedisExporter(config.REDIS_EXPORTER_URL)`.

---

## `probeRedisExporter` Specification

```ts
export function probeRedisExporter(exporterUrl: string): () => Promise<ProbeResult>
```

**Success path:**
1. GET `{exporterUrl}/metrics` with 3 s timeout
2. Match response text with `/^redis_up\s+1(\s|$)/m`
3. If matched → `{ up: true, degraded: latencyMs > 200, latencyMs }`
4. If `/^redis_up\s+0(\s|$)/m` matched (exporter reachable but Redis down) → `{ up: false, degraded: false, latencyMs }`

**Error path:**
- fetch throws (network error, timeout) → `{ up: false, degraded: false, latencyMs: elapsed }`

**Degraded threshold:** `latencyMs > 200 ms` (exporter round-trip, not Redis latency directly).

---

## Config Changes

`src/config.ts` — add one optional field:
```ts
REDIS_EXPORTER_URL: process.env.REDIS_EXPORTER_URL ?? "http://redis-exporter:9121",
```

`.env.example` — add two entries:
```env
# Redis Exporter (dashboard-metrics probe target)
REDIS_EXPORTER_URL=http://redis-exporter:9121

# Redis Exporter container (set in docker-compose environment, not here)
# REDIS_ADDR=redis://host.docker.internal:6379
```

---

## Files Changed

| File | Change |
|------|--------|
| `docker-compose.yml` | Add `redis-exporter` service; add `REDIS_ADDR` to `grafana-alloy` env block |
| `dashboard-metrics/alloy/config.alloy` | Add `prometheus.scrape "redis_exporter"` block |
| `dashboard-metrics/src/config.ts` | Add `REDIS_EXPORTER_URL` (optional, default `http://redis-exporter:9121`) |
| `dashboard-metrics/src/probes.ts` | Add `probeRedisExporter(url)`; replace `probeMock()` at redis entry |
| `dashboard-metrics/src/probes.test.ts` | Add unit tests for `probeRedisExporter` (mock fetch) |
| `dashboard-metrics/.env.example` | Document `REDIS_EXPORTER_URL` and `REDIS_ADDR` |

Total: 6 surgical edits, no new npm dependencies.

---

## Testing

Unit tests in `probes.test.ts` (bun:test, mock `fetch`):
- `redis_up 1` in response → `up: true`
- `redis_up 0` in response → `up: false`
- fetch throws → `up: false`
- latency > 200 ms → `degraded: true`

No ioredis or Redis connection needed in tests.

---

## Non-Goals

- No `redis:` service added to docker-compose (Redis itself runs externally)
- No Prometheus metric parsing library — plain text search suffices for `redis_up`
- No authentication on the exporter's `/metrics` endpoint (internal compose network only)
- MIT probe remains `probeMock()` (out of scope per user decision)
