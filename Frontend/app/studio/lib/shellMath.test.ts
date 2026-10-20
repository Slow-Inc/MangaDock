import { describe, expect, test } from "bun:test";
import { SIDEBAR, clampSidebarWidth, sparklinePoints } from "./shellMath";

describe("clampSidebarWidth: the resizable Studio sidebar (180–400 px, default 220)", () => {
  test("keeps a width inside the range", () => {
    expect(clampSidebarWidth(260)).toBe(260);
  });
  test("clamps to the limits", () => {
    expect(clampSidebarWidth(90)).toBe(SIDEBAR.min);
    expect(clampSidebarWidth(900)).toBe(SIDEBAR.max);
  });
  test("a stored value that is not a number falls back to the default", () => {
    expect(clampSidebarWidth(Number.NaN)).toBe(SIDEBAR.initial);
    expect(clampSidebarWidth(Number("abc"))).toBe(SIDEBAR.initial);
  });
});

describe("sparklinePoints: an SVG polyline for a metric card", () => {
  test("spreads values across the width, highest value at the top", () => {
    // 3 points in a 100 x 20 box with 2 px padding: x = 2, 50, 98; y: max -> 2, min -> 18
    expect(sparklinePoints([0, 10, 5], 100, 20, 2)).toBe("2,18 50,2 98,10");
  });
  test("a flat series draws a flat line through the middle", () => {
    expect(sparklinePoints([4, 4], 100, 20, 2)).toBe("2,10 98,10");
  });
  test("one value is a short centred line, none is empty", () => {
    expect(sparklinePoints([7], 100, 20, 2)).toBe("2,10 98,10");
    expect(sparklinePoints([], 100, 20, 2)).toBe("");
  });
});
