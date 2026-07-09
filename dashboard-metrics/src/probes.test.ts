import { describe, it, expect, afterEach } from "bun:test";

// Isolate config env before importing probes
process.env.METRICS_BASIC_AUTH_USER = "u";
process.env.METRICS_BASIC_AUTH_PASS = "p";
process.env.SUPABASE_HEALTH_URL = "https://test.supabase.co/health";
process.env.SUPABASE_ANON_KEY = "test-key";

const { probeStatusEndpoint, probeSupabase, probeCfWorker, probeMock, probeRedisExporter } =
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
