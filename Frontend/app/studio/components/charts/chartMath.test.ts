import { describe, expect, test } from "bun:test";
import { TONE_COLOR, breakdownChartHeight, hasValues, percentages, toneCss } from "./chartMath";

describe("TONE_COLOR: each data tone maps onto a design token, never a literal colour", () => {
  test("hue tones use their token at full strength", () => {
    expect(TONE_COLOR.indigo).toEqual({ token: "--accent", alpha: 1 });
    expect(TONE_COLOR.emerald).toEqual({ token: "--ok", alpha: 1 });
    expect(TONE_COLOR.amber).toEqual({ token: "--coin", alpha: 1 });
    expect(TONE_COLOR.rose).toEqual({ token: "--danger", alpha: 1 });
  });
  test("sky is a softer accent; violet and slate are the tertiary ink", () => {
    expect(TONE_COLOR.sky).toEqual({ token: "--accent", alpha: 0.55 });
    expect(TONE_COLOR.violet.token).toBe("--ink-3");
    expect(TONE_COLOR.slate.token).toBe("--ink-3");
  });
});

describe("toneCss: the same tone as a CSS colour for legend dots drawn in HTML", () => {
  test("full-strength tones are the bare token", () => {
    expect(toneCss("rose")).toBe("var(--danger)");
  });
  test("softer tones mix the token toward transparent", () => {
    expect(toneCss("sky")).toBe("color-mix(in srgb, var(--accent) 55%, transparent)");
  });
  test("no tone falls back to the accent", () => {
    expect(toneCss(undefined)).toBe("var(--accent)");
  });
});

describe("percentages: donut legend shares that add up to 100", () => {
  test("splits a total by largest remainder", () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentages([3, 1])).toEqual([75, 25]);
  });
  test("a zero total gives zero shares, not NaN", () => {
    expect(percentages([0, 0])).toEqual([0, 0]);
    expect(percentages([])).toEqual([]);
  });
});

describe("hasValues: a chart with nothing but zeros shows the empty state", () => {
  test("false for no values or only zeros", () => {
    expect(hasValues([])).toBe(false);
    expect(hasValues([0, 0, 0])).toBe(false);
  });
  test("true once any value is not zero", () => {
    expect(hasValues([0, 2])).toBe(true);
    expect(hasValues([0, -1])).toBe(true);
  });
});

describe("breakdownChartHeight: the horizontal bar chart grows with its rows", () => {
  test("one row per item plus the frame, never below the minimum", () => {
    expect(breakdownChartHeight(1)).toBe(120);
    expect(breakdownChartHeight(6)).toBe(6 * 36 + 24);
  });
});
