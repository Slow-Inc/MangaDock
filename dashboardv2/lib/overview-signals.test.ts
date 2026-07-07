import { describe, expect, it } from "bun:test";
import { pipelineHeaderSummary, pctDelta } from "./overview-signals";

describe("pipelineHeaderSummary", () => {
  it("returns null when there are no stages (no fabricated header on a stage-less live frame)", () => {
    expect(pipelineHeaderSummary(undefined)).toBeNull();
    expect(pipelineHeaderSummary([])).toBeNull();
  });

  it("sums real stage liveMs into a total (seconds, 1 decimal)", () => {
    const s = pipelineHeaderSummary([
      { id: "a", label: "Detect", liveMs: 1200 },
      { id: "b", label: "Translate", liveMs: 3800 },
    ]);
    expect(s).toBe("total 5.0s");
  });

  it("names the stalled stage (liveMs ≥ 30s) instead of a hardcoded one", () => {
    const s = pipelineHeaderSummary([
      { id: "a", label: "Detect", liveMs: 1000 },
      { id: "b", label: "Translate", liveMs: 35000 },
    ]);
    expect(s).toBe("total 36.0s · translate stalled");
  });

  it("reports an all-idle pipeline honestly as 0.0s, not stalled", () => {
    expect(pipelineHeaderSummary([{ id: "a", label: "Detect", liveMs: 0 }])).toBe("total 0.0s");
  });
});

describe("pctDelta", () => {
  it("returns null when the series is missing or too short to compare", () => {
    expect(pctDelta(undefined)).toBeNull();
    expect(pctDelta([])).toBeNull();
    expect(pctDelta([42])).toBeNull();
  });

  it("returns null when the baseline is 0 (no real % change to report)", () => {
    expect(pctDelta([0, 10])).toBeNull();
  });

  it("computes a real first→last change for a decline (down)", () => {
    expect(pctDelta([80, 72])).toEqual({ label: "−10.0%", up: false });
  });

  it("computes a real first→last change for a rise (up)", () => {
    expect(pctDelta([50, 60])).toEqual({ label: "+20.0%", up: true });
  });
});
