import { describe, expect, test } from "bun:test";
import { bannerPositionForKey } from "./bannerPosition";

describe("bannerPositionForKey: the banner moves from the keyboard as it does by drag (#1083)", () => {
  test("ArrowUp/ArrowRight step +5, ArrowDown/ArrowLeft step -5 (dragging up raises the value)", () => {
    expect(bannerPositionForKey("ArrowUp", 50)).toBe(55);
    expect(bannerPositionForKey("ArrowRight", 50)).toBe(55);
    expect(bannerPositionForKey("ArrowDown", 50)).toBe(45);
    expect(bannerPositionForKey("ArrowLeft", 50)).toBe(45);
  });
  test("PageUp/PageDown step 20; Home/End go to the ends", () => {
    expect(bannerPositionForKey("PageUp", 50)).toBe(70);
    expect(bannerPositionForKey("PageDown", 50)).toBe(30);
    expect(bannerPositionForKey("Home", 37)).toBe(0);
    expect(bannerPositionForKey("End", 37)).toBe(100);
  });
  test("clamped to 0..100, and a dragged fraction rounds to the step grid", () => {
    expect(bannerPositionForKey("ArrowUp", 98)).toBe(100);
    expect(bannerPositionForKey("ArrowDown", 3)).toBe(0);
    expect(bannerPositionForKey("ArrowUp", 42.7)).toBe(48);
  });
  test("other keys are not the slider's (null)", () => {
    expect(bannerPositionForKey("Tab", 50)).toBeNull();
    expect(bannerPositionForKey("Enter", 50)).toBeNull();
  });
});
