import { describe, expect, test } from "bun:test";
import {
  zoomInLevel,
  zoomOutLevel,
  ZOOM_MIN,
  ZOOM_MAX,
} from "./zoomLevel";

describe("zoomInLevel", () => {
  test("steps up by 0.25", () => {
    expect(zoomInLevel(0.5)).toBe(0.75);
    expect(zoomInLevel(1)).toBe(1.25);
    expect(zoomInLevel(1.25)).toBe(1.5);
  });

  test("clamps at ZOOM_MAX", () => {
    expect(zoomInLevel(2.75)).toBe(ZOOM_MAX); // 3.0
    expect(zoomInLevel(2.9)).toBe(ZOOM_MAX); // 3.15 → clamp
    expect(zoomInLevel(3)).toBe(ZOOM_MAX); // already max
  });

  test("rounds to 2dp so repeated steps don't drift", () => {
    // 1.35 + 0.25 = 1.5999999999999999 without the toFixed
    expect(zoomInLevel(1.35)).toBe(1.6);
  });
});

describe("zoomOutLevel", () => {
  test("steps down by 0.25", () => {
    expect(zoomOutLevel(3)).toBe(2.75);
    expect(zoomOutLevel(1)).toBe(0.75);
    expect(zoomOutLevel(1.6)).toBe(1.35);
  });

  test("clamps at ZOOM_MIN", () => {
    expect(zoomOutLevel(0.75)).toBe(ZOOM_MIN); // 0.5
    expect(zoomOutLevel(0.6)).toBe(ZOOM_MIN); // 0.35 → clamp
    expect(zoomOutLevel(0.5)).toBe(ZOOM_MIN); // already min
  });
});

describe("zoom ladder round-trips", () => {
  test("in then out returns to the same level on the 0.25 grid", () => {
    expect(zoomOutLevel(zoomInLevel(1))).toBe(1);
    expect(zoomOutLevel(zoomInLevel(2.5))).toBe(2.5);
  });
});
