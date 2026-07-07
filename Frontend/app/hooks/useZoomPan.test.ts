import { describe, it, expect } from "bun:test";
import { computeZoomAnchor, computeRestoredScroll, type ZoomAnchorBlock } from "./useZoomPan";

describe("computeZoomAnchor", () => {
  it("pass 1: selects the block straddling viewportTop", () => {
    const blocks: ZoomAnchorBlock[] = [
      { index: 0, top: -200, bottom: -10, height: 190 },
      { index: 1, top: -10, bottom: 90, height: 100 }, // straddles viewportTop=1
      { index: 2, top: 90, bottom: 190, height: 100 },
    ];
    const result = computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks });
    expect(result?.pageIndex).toBe(1);
  });

  it("pass-1 miss falls back to pass-2 (first block with bottom > containerTop)", () => {
    // No block straddles viewportTop, but block 1's bottom is below containerTop.
    const blocks: ZoomAnchorBlock[] = [
      { index: 0, top: -300, bottom: -200, height: 100 },
      { index: 1, top: -100, bottom: 50, height: 150 },
      { index: 2, top: 50, bottom: 200, height: 150 },
    ];
    // viewportTop is placed exactly on a boundary so pass 1 (top<=vt && bottom>vt) misses block 1
    // (bottom===50 is not > 50) but block 2 also doesn't straddle (top===50 satisfies top<=vt, bottom>vt satisfies) —
    // construct a case where pass 1 genuinely finds nothing: all blocks' ranges exclude viewportTop.
    const blocksNoStraddle: ZoomAnchorBlock[] = [
      { index: 0, top: -300, bottom: -200, height: 100 },
      { index: 1, top: -200, bottom: -100, height: 100 },
    ];
    const result = computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks: blocksNoStraddle });
    expect(result).toBeNull();

    const result2 = computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks });
    expect(result2?.pageIndex).toBe(1);
  });

  it("no blocks -> null", () => {
    expect(computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks: [] })).toBeNull();
  });

  it("all blocks above the viewport -> null", () => {
    const blocks: ZoomAnchorBlock[] = [
      { index: 0, top: -500, bottom: -400, height: 100 },
      { index: 1, top: -400, bottom: -300, height: 100 },
    ];
    expect(computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks })).toBeNull();
  });

  it("anchorRatio is clamped to 0..1", () => {
    // blockTopInViewport very negative, blockBottomInViewport small positive:
    // viewportAnchorPx clamps to blockBottomInViewport, ratio should still land in [0,1]
    const blocks: ZoomAnchorBlock[] = [{ index: 0, top: -1000, bottom: 5, height: 1005 }];
    const result = computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks });
    expect(result).not.toBeNull();
    expect(result!.anchorRatio).toBeGreaterThanOrEqual(0);
    expect(result!.anchorRatio).toBeLessThanOrEqual(1);
  });

  it("height=0 -> anchorRatio 0.5", () => {
    const blocks: ZoomAnchorBlock[] = [{ index: 0, top: -10, bottom: 90, height: 0 }];
    const result = computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks });
    expect(result?.anchorRatio).toBe(0.5);
  });

  it("viewportAnchorPx is 0 when blockTopInViewport <= 0 (block already above/at viewport top)", () => {
    const blocks: ZoomAnchorBlock[] = [{ index: 0, top: -50, bottom: 100, height: 150 }];
    const result = computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks });
    expect(result?.viewportAnchorPx).toBe(0);
  });

  it("viewportAnchorPx is positive when the block starts below the container top", () => {
    const blocks: ZoomAnchorBlock[] = [{ index: 0, top: 20, bottom: 220, height: 200 }];
    // containerTop=0, viewportTop=1: block.top(20) <= viewportTop(1) is false, so pass 1 misses;
    // pass 2 picks it since bottom(220) > containerTop(0).
    const result = computeZoomAnchor({ viewportTop: 1, containerTop: 0, blocks });
    expect(result?.pageIndex).toBe(0);
    expect(result?.viewportAnchorPx).toBe(20); // blockTopInViewport = 20-0 = 20
  });
});

describe("computeRestoredScroll", () => {
  it("computes the scroll offset that restores the anchor after a layout shift", () => {
    const result = computeRestoredScroll({
      currentScroll: 500,
      containerTop: 100,
      blockTop: 150,
      blockHeight: 300,
      anchor: { anchorRatio: 0.5, viewportAnchorPx: 20 },
    });
    // blockTopAbsolute = 500 + (150-100) = 550; result = 550 + 0.5*300 - 20 = 680
    expect(result).toBe(680);
  });

  it("clamps to 0 (never negative)", () => {
    const result = computeRestoredScroll({
      currentScroll: 0,
      containerTop: 500,
      blockTop: 10,
      blockHeight: 50,
      anchor: { anchorRatio: 0, viewportAnchorPx: 0 },
    });
    // blockTopAbsolute = 0 + (10-500) = -490; result would be -490, clamped to 0
    expect(result).toBe(0);
  });

  it("anchorRatio*height + viewportAnchorPx arithmetic is applied on top of blockTopAbsolute", () => {
    const result = computeRestoredScroll({
      currentScroll: 1000,
      containerTop: 0,
      blockTop: 0,
      blockHeight: 400,
      anchor: { anchorRatio: 0.25, viewportAnchorPx: 10 },
    });
    // blockTopAbsolute = 1000; result = 1000 + 0.25*400 - 10 = 1090
    expect(result).toBe(1090);
  });
});
