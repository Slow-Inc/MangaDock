import { describe, expect, test } from "bun:test";
import { visibilityStore } from "./pageVisibility";

/**
 * A stand-in for `document` with its own listener list — no DOM globals, which other suites replace
 * (a global Event from another realm is rejected by EventTarget.dispatchEvent).
 */
function fakeDoc(initial: DocumentVisibilityState) {
  const listeners = new Set<() => void>();
  return {
    visibilityState: initial,
    addEventListener: (_type: string, fn: () => void) => { listeners.add(fn); },
    removeEventListener: (_type: string, fn: () => void) => { listeners.delete(fn); },
    dispatchEvent: () => true,
    flip(state: DocumentVisibilityState) { this.visibilityState = state; listeners.forEach((fn) => fn()); },
  };
}

describe("visibilityStore: is this tab visible right now (#821)", () => {
  test("reports the current state", () => {
    expect(visibilityStore(fakeDoc("visible")).getSnapshot()).toBe(true);
    expect(visibilityStore(fakeDoc("hidden")).getSnapshot()).toBe(false);
  });

  test("notifies on visibilitychange and stops after unsubscribe", () => {
    const doc = fakeDoc("visible");
    const store = visibilityStore(doc);
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls++; });
    doc.flip("hidden");
    expect(calls).toBe(1);
    expect(store.getSnapshot()).toBe(false);
    unsubscribe();
    doc.flip("visible");
    expect(calls).toBe(1);
  });
});
