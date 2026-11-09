import { describe, expect, test } from "bun:test";
import { dragOffset, stepIndex, swipeTarget } from "./imageViewer";

describe("stepIndex: arrows and keys move one image, no wrap (#1094)", () => {
  test("next and previous within range", () => {
    expect(stepIndex(1, 1, 4)).toBe(2);
    expect(stepIndex(1, -1, 4)).toBe(0);
  });
  test("clamped at both ends, like IG", () => {
    expect(stepIndex(3, 1, 4)).toBe(3);
    expect(stepIndex(0, -1, 4)).toBe(0);
  });
});

describe("swipeTarget: where a released swipe lands (#1094)", () => {
  const base = { width: 400, index: 1, count: 4 };
  test("a drag past a fifth of the width moves one image (left = next)", () => {
    expect(swipeTarget({ ...base, dx: -90, velocity: 0 })).toBe(2);
    expect(swipeTarget({ ...base, dx: 90, velocity: 0 })).toBe(0);
  });
  test("a short slow drag snaps back", () => {
    expect(swipeTarget({ ...base, dx: -40, velocity: -0.1 })).toBe(1);
  });
  test("a short fast flick still moves", () => {
    expect(swipeTarget({ ...base, dx: -30, velocity: -0.8 })).toBe(2);
  });
  test("never past either end", () => {
    expect(swipeTarget({ ...base, index: 3, dx: -300, velocity: -2 })).toBe(3);
    expect(swipeTarget({ ...base, index: 0, dx: 300, velocity: 2 })).toBe(0);
  });
});

describe("dragOffset: the image follows the finger, and the ends resist (#1094)", () => {
  test("in the middle the drag is 1:1", () => {
    expect(dragOffset(-80, 1, 4)).toBe(-80);
  });
  test("pulling past the first or last image moves a third as far", () => {
    expect(dragOffset(90, 0, 4)).toBe(30);
    expect(dragOffset(-90, 3, 4)).toBe(-30);
  });
});
