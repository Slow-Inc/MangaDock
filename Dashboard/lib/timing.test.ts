import { test, expect } from "bun:test";
import { assessTiming, type StageTiming } from "./timing";

const stages: StageTiming[] = [
  { id: "detect", label: "Detection", baselineMs: 800, liveMs: 820 }, // +2.5% ok
  { id: "ocr", label: "OCR", baselineMs: 1200, liveMs: 1240 }, // +3% ok
  { id: "render", label: "Render", baselineMs: 1200, liveMs: 2100 }, // +75% regressed
];

test("delta percent is computed against baseline", () => {
  const r = assessTiming(stages);
  expect(r.stages.find((s) => s.id === "render")!.deltaPct).toBe(75);
});

test("a stage at or beyond the regression threshold is flagged", () => {
  const r = assessTiming(stages);
  expect(r.stages.find((s) => s.id === "render")!.regressed).toBe(true);
  expect(r.stages.find((s) => s.id === "detect")!.regressed).toBe(false);
  expect(r.regressedCount).toBe(1);
});

test("totals sum baseline and live", () => {
  const r = assessTiming(stages);
  expect(r.totalBaselineMs).toBe(3200);
  expect(r.totalLiveMs).toBe(4160);
});
