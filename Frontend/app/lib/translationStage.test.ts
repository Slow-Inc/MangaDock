import { describe, expect, test } from "bun:test";
import { createStageTracker } from "./translationStage";

// #1126: with concurrent MIT pages (#1122) stage events from several pages interleave; the label must
// follow ONE page (the earliest still in flight) instead of jumping to whichever page spoke last.
describe("createStageTracker", () => {
  test("a single page behaves as before", () => {
    const t = createStageTracker();
    expect(t.stage(4, "ocr")).toEqual({ pageIndex: 4, stage: "ocr" });
    expect(t.stage(4, "rendering")).toEqual({ pageIndex: 4, stage: "rendering" });
    expect(t.done(4)).toBeNull();
  });

  test("interleaved pages keep the earliest page on the label", () => {
    const t = createStageTracker();
    t.stage(2, "detection");
    expect(t.stage(0, "ocr")).toEqual({ pageIndex: 2, stage: "detection" });
    expect(t.stage(2, "translation")).toEqual({ pageIndex: 2, stage: "translation" });
    expect(t.stage(5, "ocr")).toEqual({ pageIndex: 2, stage: "translation" });
  });

  test("when the shown page finishes, the next earliest in-flight page takes over", () => {
    const t = createStageTracker();
    t.stage(2, "detection");
    t.stage(0, "ocr");
    t.stage(5, "translation");
    expect(t.done(2)).toEqual({ pageIndex: 0, stage: "ocr" });
    expect(t.done(0)).toEqual({ pageIndex: 5, stage: "translation" });
    expect(t.done(5)).toBeNull();
  });

  test("reset clears everything", () => {
    const t = createStageTracker();
    t.stage(1, "ocr");
    t.reset();
    expect(t.done(1)).toBeNull();
  });
});
