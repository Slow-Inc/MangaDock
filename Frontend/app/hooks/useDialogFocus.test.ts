import { describe, expect, test } from "bun:test";
import { focusWrapTarget } from "./useDialogFocus";

describe("focusWrapTarget: Tab stays inside the dialog (#837)", () => {
  test("Tab on the last control wraps to the first", () => {
    expect(focusWrapTarget({ index: 4, count: 5, backwards: false })).toBe(0);
  });
  test("Shift+Tab on the first control wraps to the last", () => {
    expect(focusWrapTarget({ index: 0, count: 5, backwards: true })).toBe(4);
  });
  test("focus outside the dialog (index -1) is pulled to the first or last control", () => {
    expect(focusWrapTarget({ index: -1, count: 5, backwards: false })).toBe(0);
    expect(focusWrapTarget({ index: -1, count: 5, backwards: true })).toBe(4);
  });
  test("in the middle the browser moves focus itself (null)", () => {
    expect(focusWrapTarget({ index: 2, count: 5, backwards: false })).toBeNull();
    expect(focusWrapTarget({ index: 2, count: 5, backwards: true })).toBeNull();
  });
  test("focus inside another layer opened from the dialog (reader, lightbox) is left alone", () => {
    expect(focusWrapTarget({ index: -1, count: 5, backwards: false, focusInOtherLayer: true })).toBeNull();
    expect(focusWrapTarget({ index: -1, count: 5, backwards: true, focusInOtherLayer: true })).toBeNull();
  });
  test("no focusable controls: nothing to do", () => {
    expect(focusWrapTarget({ index: -1, count: 0, backwards: false })).toBeNull();
  });
});
