import { describe, expect, test } from "bun:test";
import { stripScrollLeft } from "./stripScroll";

// strip 390 wide, padding 16; items given as offsetLeft / width inside the strip's scroll area.
describe("stripScrollLeft: where a scrolling tab strip should sit so its active tab is visible (#830)", () => {
  test("leaves the strip alone when the tab is already visible", () => {
    expect(stripScrollLeft({ scrollLeft: 0, itemLeft: 100, itemWidth: 80, stripWidth: 390, pad: 16 })).toBe(0);
  });
  test("scrolls right just enough to show a tab past the right edge, plus padding", () => {
    expect(stripScrollLeft({ scrollLeft: 0, itemLeft: 400, itemWidth: 90, stripWidth: 390, pad: 16 })).toBe(116);
  });
  test("scrolls left to show a tab hidden on the left, minus padding, never below 0", () => {
    expect(stripScrollLeft({ scrollLeft: 200, itemLeft: 120, itemWidth: 80, stripWidth: 390, pad: 16 })).toBe(104);
    expect(stripScrollLeft({ scrollLeft: 50, itemLeft: 8, itemWidth: 80, stripWidth: 390, pad: 16 })).toBe(0);
  });
});
