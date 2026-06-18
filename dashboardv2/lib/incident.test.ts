import { test, expect } from "bun:test";
import { gatewayDiagnosis, vramBloat, workerSaturation, formatDuration } from "./incident";

// gatewayDiagnosis — localize control-plane (host reachable) vs data-plane (translate works),
// and map a known bad state to a recovery action.
test("gateway healthy → both planes up, no hint", () => {
  const d = gatewayDiagnosis({ status: "ok", detail: "ok", latencyMs: 120, controlMs: 90 });
  expect(d.control).toBe("up");
  expect(d.data).toBe("up");
  expect(d.ok).toBe(true);
  expect(d.hint).toBeNull();
});

test("gateway reachable but translate stalled (the mock scene) → control up, data down, hint", () => {
  const d = gatewayDiagnosis({ status: "down", detail: "model not responding", latencyMs: null, controlMs: 190 });
  expect(d.control).toBe("up");
  expect(d.data).toBe("down");
  expect(d.ok).toBe(false);
  expect(d.hint).toContain("translate down");
});

test("known bad states each map to a recovery hint", () => {
  expect(gatewayDiagnosis({ status: "timeout", detail: "", latencyMs: null, controlMs: 90 }).hint).toContain("reload-models");
  expect(gatewayDiagnosis({ status: "unreachable", detail: "", latencyMs: null, controlMs: null }).hint).toContain("tunnel");
  expect(gatewayDiagnosis({ status: "auth", detail: "", latencyMs: null, controlMs: 90 }).hint).toContain("token");
  expect(gatewayDiagnosis({ status: "model_missing", detail: "", latencyMs: null, controlMs: 90 }).hint).toContain("model");
});

test("unreachable host (no control probe) → control down", () => {
  expect(gatewayDiagnosis({ status: "unreachable", detail: "", latencyMs: null, controlMs: null }).control).toBe("down");
});

test("no gateway → unknown planes, not ok", () => {
  const d = gatewayDiagnosis(null);
  expect(d.control).toBe("unknown");
  expect(d.data).toBe("unknown");
  expect(d.ok).toBe(false);
  expect(d.hint).toBeNull();
});

// vramBloat — reserved minus allocated = held / leaking allocator memory.
test("vramBloat computes the held gap in GB (mock scene, under threshold)", () => {
  const b = vramBloat({ allocatedMb: 5940, reservedMb: 6300, models: [] })!;
  expect(b.allocatedGb).toBe(5.8);
  expect(b.reservedGb).toBe(6.2);
  expect(b.heldGb).toBe(0.4);
  expect(b.bloated).toBe(false);
});

test("vramBloat flags a large held gap as bloated", () => {
  expect(vramBloat({ allocatedMb: 5000, reservedMb: 7100, models: [] })!.bloated).toBe(true);
});

test("vramBloat is null when allocator figures are absent", () => {
  expect(vramBloat({ allocatedMb: null, reservedMb: null, models: [] })).toBeNull();
  expect(vramBloat(null)).toBeNull();
});

// workerSaturation — free=0 with a backlog = the pipeline is the bottleneck.
test("workerSaturation flags saturated when no free worker and a queue", () => {
  const s = workerSaturation({ alive: 1, total: 1, free: 0 }, 3);
  expect(s.saturated).toBe(true);
  expect(s.free).toBe(0);
  expect(s.total).toBe(1);
  expect(s.queued).toBe(3);
});

test("workerSaturation not saturated when a worker is free", () => {
  expect(workerSaturation({ alive: 2, total: 2, free: 1 }, 3).saturated).toBe(false);
});

test("workerSaturation not saturated when the queue is empty", () => {
  expect(workerSaturation({ alive: 1, total: 1, free: 0 }, 0).saturated).toBe(false);
});

// formatDuration — incident age, mono tabular.
test("formatDuration renders s / m s / h m and clamps negatives", () => {
  expect(formatDuration(11000)).toBe("11s");
  expect(formatDuration(228000)).toBe("3m 48s");
  expect(formatDuration(3840000)).toBe("1h 04m");
  expect(formatDuration(-5)).toBe("0s");
});
