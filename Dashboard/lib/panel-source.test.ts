import { test, expect } from "bun:test";
import { isNoData, panelSource } from "./panel-source";

test("isNoData is true for absent / empty values (null, undefined, [], blank string)", () => {
  expect(isNoData(null)).toBe(true);
  expect(isNoData(undefined)).toBe(true);
  expect(isNoData([])).toBe(true);
  expect(isNoData("")).toBe(true);
  expect(isNoData("   ")).toBe(true);
});

test("isNoData is false for real values — crucially ZERO is data, not absence", () => {
  expect(isNoData(0)).toBe(false); // queue depth 0 / GPU 0% are real
  expect(isNoData(42)).toBe(false);
  expect(isNoData([1, 2])).toBe(false);
  expect(isNoData("ok")).toBe(false);
  expect(isNoData({ a: 1 })).toBe(false);
});

test("panelSource: surfaces MIT reports directly are mit-live", () => {
  for (const id of ["gpu", "host", "vram", "gateway", "queue", "workers", "stage-timing", "mit-feed", "gpu-detail", "worker-lifecycle", "translate-queue", "mit-console"]) {
    expect(panelSource(id)).toBe("mit-live");
  }
});

test("panelSource: overview panels with both MIT + non-MIT items are mixed", () => {
  for (const id of ["system-flow", "subsystem-board", "pipeline"]) {
    expect(panelSource(id)).toBe("mixed");
  }
});

test("panelSource: surfaces with no live feed are no-source", () => {
  for (const id of ["frontend", "backend", "traffic", "stream-health", "incidents", "cache-tiers", "economy", "edge", "node-cluster", "writepath", "quality"]) {
    expect(panelSource(id)).toBe("no-source");
  }
});

test("panelSource defaults unknown ids to no-source (fail-safe — never fake/over-claim data)", () => {
  expect(panelSource("anything-unknown")).toBe("no-source");
});
