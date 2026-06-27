import { describe, expect, test } from "bun:test";
import { computeScrollState } from "./horizontalScroll";

describe("computeScrollState", () => {
  test("start: scrollLeft 0 → canScrollLeft false, canScrollRight true", () => {
    expect(computeScrollState({ scrollLeft: 0, clientWidth: 300, scrollWidth: 1000 })).toEqual({
      canScrollLeft: false,
      canScrollRight: true,
    });
  });

  test("middle: scrolled partway → both true", () => {
    expect(computeScrollState({ scrollLeft: 100, clientWidth: 300, scrollWidth: 1000 })).toEqual({
      canScrollLeft: true,
      canScrollRight: true,
    });
  });

  test("end: scrollLeft + clientWidth >= scrollWidth - 1 → canScrollRight false", () => {
    expect(computeScrollState({ scrollLeft: 700, clientWidth: 300, scrollWidth: 1000 })).toEqual({
      canScrollLeft: true,
      canScrollRight: false,
    });
  });

  test("not overflowing: clientWidth === scrollWidth → both false", () => {
    expect(computeScrollState({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 1000 })).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });
});
