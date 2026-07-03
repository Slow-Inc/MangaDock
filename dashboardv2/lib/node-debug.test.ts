import { test, expect } from "bun:test";
import { buildNodeDebug } from "./node-debug";

// Behaviour: the per-node debug popup groups a node's telemetry into categories. A field MIT doesn't
// emit (most per-node metrics today) comes through as null → the popup renders <NoData> for it, so the
// mock→real switch is honest (#304 grill: draft mock full, extend MIT later → fields fill in).

const FULL = {
  id: "gpu0", online: true,
  gpuUsage: 64, cpuUsage: 42, gpuClockMhz: 2610, cpuClockMhz: 4100,
  vramUsedGb: 5.8, vramTotalGb: 12.3, ramUsedGb: 9.8, ramTotalGb: 32,
  gpuTempC: 67, cpuTempC: 55, fanPct: 55, powerW: 182, bandwidthMbps: 940,
};

test("groups metrics into the debug categories in order", () => {
  expect(buildNodeDebug(FULL).map((s) => s.title)).toEqual(["Compute", "Memory", "Thermal", "Power", "Network"]);
});

test("populates a metric from the node value with its unit", () => {
  const gpu = buildNodeDebug(FULL).find((s) => s.title === "Compute")!.metrics.find((m) => m.label === "GPU usage")!;
  expect(gpu.value).toBe(64);
  expect(gpu.unit).toBe("%");
});

test("a field MIT doesn't emit is null → the popup shows No Data", () => {
  const sparse = { id: "w-5013", online: true, gpuUsage: 64 }; // clocks/temps/power absent
  const compute = buildNodeDebug(sparse).find((s) => s.title === "Compute")!;
  expect(compute.metrics.find((m) => m.label === "GPU clock")!.value).toBeNull();
});

test("Memory combines used / total, null if either is missing", () => {
  expect(buildNodeDebug(FULL).find((s) => s.title === "Memory")!.metrics.find((m) => m.label === "VRAM")!.value).toBe("5.8 / 12.3");
  expect(buildNodeDebug({ id: "x", online: true, vramUsedGb: 5.8 }).find((s) => s.title === "Memory")!.metrics.find((m) => m.label === "VRAM")!.value).toBeNull();
});
