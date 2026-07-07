import { test, expect } from "bun:test";
import { mapMitSnapshot } from "./live-map";

const FRAME = {
  type: "metric" as const,
  service: "mit",
  ts: 1718383200,
  status: "degraded",
  host: { cpu_pct: 42, ram_used_mb: 9800, ram_total_mb: 32000, disk_used_pct: 99.1 },
  gpus: [{ util_pct: 65, temp_c: 68, power_w: 120, fan_pct: 40, vram_used_mb: 5900, vram_total_mb: 12282 }],
  gateway: { status: "timeout", latency_ms: null, detail: "model not responding" },
  queue: { size: 2 },
  workers: { alive: 1, total: 1, free: 0 },
  translator: "custom_openai",
};

test("maps the gpu fields and converts VRAM mb→gb", () => {
  const m = mapMitSnapshot(FRAME);
  expect(m.gpu).toEqual({ utilPct: 65, tempC: 68, powerW: 120, fanPct: 40, vramUsedGb: 5.8, vramTotalGb: 12.0 });
});

test("maps host fields and converts RAM mb→gb", () => {
  const m = mapMitSnapshot(FRAME);
  expect(m.host).toEqual({ cpuPct: 42, ramUsedGb: 9.6, ramTotalGb: 31.3, diskUsedPct: 99.1 });
});

test("passes status / gateway / queue / workers / translator through", () => {
  const m = mapMitSnapshot(FRAME);
  expect(m.status).toBe("degraded");
  expect(m.gateway).toEqual({ status: "timeout", detail: "model not responding", latencyMs: null, controlMs: null });
  expect(m.queueSize).toBe(2);
  expect(m.workers).toEqual({ alive: 1, total: 1, free: 0 });
  expect(m.translator).toBe("custom_openai");
});

test("gpu is null when no GPU is present (host stays observable)", () => {
  const m = mapMitSnapshot({ ...FRAME, gpus: [] });
  expect(m.gpu).toBeNull();
  expect(m.host.cpuPct).toBe(42);
});

test("tolerates a null gateway (unprobed)", () => {
  const m = mapMitSnapshot({ ...FRAME, gateway: null });
  expect(m.gateway).toBeNull();
});
