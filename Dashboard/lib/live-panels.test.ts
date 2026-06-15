import { test, expect } from "bun:test";
import { gatewayHealth, applyMitSubsystems, mitTranslateStage, liveGatewayProbe } from "./live-panels";
import type { Subsystem } from "./health";
import type { MitLive } from "./live-map";

function mit(over: Partial<MitLive> = {}): MitLive {
  return {
    status: "up", ts: 1,
    gpu: { utilPct: 64, tempC: 67, powerW: 120, fanPct: 40, vramUsedGb: 5.8, vramTotalGb: 12.0 },
    host: { cpuPct: 42, ramUsedGb: 9.6, ramTotalGb: 31.3, diskUsedPct: 99 },
    gateway: { status: "ok", detail: "gateway and model healthy", latencyMs: 120, controlMs: 30 },
    queueSize: 1, workers: { alive: 1, total: 1, free: 0 }, translator: "custom_openai",
    ...over,
  };
}

const SUBS: Subsystem[] = [
  { id: "gateway", label: "9arm gateway", kind: "gateway", health: "down", detail: "model timeout ×3", latencyMs: 190 },
  { id: "redis", label: "Redis · L2", kind: "cache", health: "up", detail: "pub/sub ok", latencyMs: 1 },
  { id: "gpu", label: "GPU · RTX 4070S", kind: "gpu", health: "up", detail: "65% · 5.8/12.3 GB", latencyMs: 0 },
];

test("gatewayHealth maps probe status to subsystem health", () => {
  expect(gatewayHealth("ok")).toBe("up");
  expect(gatewayHealth("slow")).toBe("degraded");
  expect(gatewayHealth("timeout")).toBe("down");
  expect(gatewayHealth("unreachable")).toBe("down");
});

test("applyMitSubsystems overrides ONLY gateway + gpu, leaving others (redis) untouched", () => {
  const out = applyMitSubsystems(SUBS, mit({ gateway: { status: "timeout", detail: "model not responding", latencyMs: null, controlMs: null } }));
  const gw = out.find((s) => s.id === "gateway")!;
  expect(gw.health).toBe("down");
  expect(gw.detail).toBe("model not responding");
  const gpu = out.find((s) => s.id === "gpu")!;
  expect(gpu.health).toBe("up");
  expect(gpu.detail).toContain("5.8/12");
  expect(out.find((s) => s.id === "redis")).toEqual(SUBS[1]); // untouched mock
});

test("applyMitSubsystems leaves a subsystem as-is when the live source is absent", () => {
  const out = applyMitSubsystems(SUBS, mit({ gateway: null, gpu: null }));
  expect(out.find((s) => s.id === "gateway")).toEqual(SUBS[0]);
  expect(out.find((s) => s.id === "gpu")).toEqual(SUBS[2]);
});

test("mitTranslateStage: healthy gateway → success", () => {
  expect(mitTranslateStage(mit())?.status).toBe("success");
});

test("mitTranslateStage: bad gateway → error with the gateway detail", () => {
  const st = mitTranslateStage(mit({ gateway: { status: "timeout", detail: "model not responding — timed out", latencyMs: null, controlMs: null } }));
  expect(st?.status).toBe("error");
  expect(st?.detail).toContain("timed out");
});

test("mitTranslateStage: no gateway probe → null (caller keeps mock)", () => {
  expect(mitTranslateStage(mit({ gateway: null }))).toBeNull();
});

test("liveGatewayProbe maps the real control/data split (healthy)", () => {
  expect(liveGatewayProbe(mit())).toEqual({ controlOk: true, controlMs: 30, dataState: "ok", dataMs: 120 });
});

test("liveGatewayProbe: model hung = control up, data timeout", () => {
  const p = liveGatewayProbe(mit({ gateway: { status: "timeout", detail: "chat timed out", latencyMs: null, controlMs: 190 } }))!;
  expect(p.controlOk).toBe(true);
  expect(p.controlMs).toBe(190);
  expect(p.dataState).toBe("timeout");
});

test("liveGatewayProbe: unreachable = control down", () => {
  const p = liveGatewayProbe(mit({ gateway: { status: "unreachable", detail: "no connect", latencyMs: null, controlMs: null } }))!;
  expect(p.controlOk).toBe(false);
  expect(p.dataState).toBe("error");
});

test("liveGatewayProbe: no probe → null", () => {
  expect(liveGatewayProbe(mit({ gateway: null }))).toBeNull();
});
