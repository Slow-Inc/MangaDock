import { describe, expect, test } from "bun:test";
import { heroAutoplay, motionStore, scrollBehavior } from "./reducedMotion";

/** A stand-in for a MediaQueryList with its own listener list — no DOM globals (see pageVisibility.test.ts). */
function fakeQuery(initial: boolean) {
  const listeners = new Set<() => void>();
  return {
    matches: initial,
    addEventListener: (_type: "change", fn: () => void) => { listeners.add(fn); },
    removeEventListener: (_type: "change", fn: () => void) => { listeners.delete(fn); },
    flip(matches: boolean) { this.matches = matches; listeners.forEach((fn) => fn()); },
  };
}

describe("motionStore: does the user ask for reduced motion (#849)", () => {
  test("reports the current preference", () => {
    expect(motionStore(fakeQuery(true)).getSnapshot()).toBe(true);
    expect(motionStore(fakeQuery(false)).getSnapshot()).toBe(false);
  });

  test("notifies when the preference changes and stops after unsubscribe", () => {
    const query = fakeQuery(false);
    const store = motionStore(query);
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls++; });
    query.flip(true);
    expect(calls).toBe(1);
    expect(store.getSnapshot()).toBe(true);
    unsubscribe();
    query.flip(false);
    expect(calls).toBe(1);
  });
});

describe("heroAutoplay: does the hero rotate on its own (#849)", () => {
  test("rotates by default and stays still under reduced motion", () => {
    expect(heroAutoplay(null, false)).toBe(true);
    expect(heroAutoplay(null, true)).toBe(false);
  });

  test("the user's pause or play wins over the preference", () => {
    expect(heroAutoplay(false, false)).toBe(false);
    expect(heroAutoplay(true, true)).toBe(true);
  });
});

describe("scrollBehavior: JS-initiated scrolling (#852)", () => {
  test("jumps under reduced motion, glides otherwise", () => {
    expect(scrollBehavior(fakeQuery(true))).toBe("auto");
    expect(scrollBehavior(fakeQuery(false))).toBe("smooth");
  });
});
