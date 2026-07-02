import { test, expect } from "bun:test";
import { diagnoseGateway } from "./gateway";

test("healthy when control plane is up and the model responds", () => {
  expect(diagnoseGateway({ controlOk: true, controlMs: 190, dataState: "ok", dataMs: 2400 }).plane).toBe("healthy");
});

test("the 2026-06-14 signature: control up but completion timed out → data plane", () => {
  const d = diagnoseGateway({ controlOk: true, controlMs: 190, dataState: "timeout", dataMs: 151000 });
  expect(d.plane).toBe("data-plane");
  expect(d.cause).toBe("model not responding");
  expect(d.hint).toContain("0.19s");
  expect(d.hint).toContain("151s");
});

test("an unreachable /models is a control-plane fault", () => {
  const d = diagnoseGateway({ controlOk: false, controlMs: 0, dataState: "error", dataMs: 0 });
  expect(d.plane).toBe("control-plane");
});

test("a slow-but-responding completion is a data-plane warning", () => {
  expect(diagnoseGateway({ controlOk: true, controlMs: 200, dataState: "slow", dataMs: 38000 }).cause).toBe("model slow");
});
