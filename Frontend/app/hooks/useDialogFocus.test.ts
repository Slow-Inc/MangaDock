import { describe, expect, test } from "bun:test";
import { cycleTarget, focusWrapTarget, hasLayerAbove } from "./useDialogFocus";

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

describe("hasLayerAbove: another layer shown over this one (#840)", () => {
  // Fake body children: { layer, z }. `self` marks the element being asked about.
  type N = { layer: boolean; z: number; self?: boolean };
  const ask = (...nodes: N[]) => {
    const parent = { children: nodes } as unknown as Element;
    const el = nodes.find((n) => n.self)!;
    (el as unknown as { parentElement: unknown }).parentElement = parent;
    return hasLayerAbove(el as unknown as Element, { isLayer: (n) => (n as unknown as N).layer, zIndex: (n) => (n as unknown as N).z });
  };
  test("alone: on top", () => {
    expect(ask({ layer: true, z: 300, self: true })).toBe(false);
  });
  test("a visible layer with a higher z-index is above, even if it comes earlier (the login prompt bar)", () => {
    expect(ask({ layer: true, z: 9999 }, { layer: true, z: 300, self: true })).toBe(true);
  });
  test("a lower layer (the popup underneath) is not above", () => {
    expect(ask({ layer: true, z: 200 }, { layer: true, z: 300, self: true })).toBe(false);
  });
  test("same z-index: only a later one is above", () => {
    expect(ask({ layer: true, z: 300, self: true }, { layer: true, z: 300 })).toBe(true);
    expect(ask({ layer: true, z: 300 }, { layer: true, z: 300, self: true })).toBe(false);
  });
  test("hidden prompts (not layers) do not count", () => {
    expect(ask({ layer: false, z: 9999 }, { layer: true, z: 300, self: true })).toBe(false);
  });
});

describe("cycleTarget: with a toast up, Tab walks the dialog's and the toast's controls as one cycle (#956)", () => {
  // 5 dialog controls (0-4) then the toast's "เข้าสู่ระบบ" (5) and "ปิด" (6)
  test("Tab from the dialog's last control reaches the toast", () => {
    expect(cycleTarget({ index: 4, count: 7, backwards: false })).toBe(5);
  });
  test("Tab from the toast's last control comes back to the dialog's first", () => {
    expect(cycleTarget({ index: 6, count: 7, backwards: false })).toBe(0);
  });
  test("Shift+Tab from the dialog's first control reaches the toast's last", () => {
    expect(cycleTarget({ index: 0, count: 7, backwards: true })).toBe(6);
  });
  test("Shift+Tab from the toast's first control goes back into the dialog", () => {
    expect(cycleTarget({ index: 5, count: 7, backwards: true })).toBe(4);
  });
  test("focus lost (on <body>) is pulled in at the start or the end", () => {
    expect(cycleTarget({ index: -1, count: 7, backwards: false })).toBe(0);
    expect(cycleTarget({ index: -1, count: 7, backwards: true })).toBe(6);
  });
});
