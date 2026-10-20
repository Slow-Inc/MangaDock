import { describe, expect, test } from "bun:test";
import { visibilityStore } from "./pageVisibility";

/** A stand-in for `document`: an EventTarget whose visibilityState the test flips. */
function fakeDoc(initial: DocumentVisibilityState) {
  const t = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
  t.visibilityState = initial;
  return t;
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
    doc.visibilityState = "hidden"; doc.dispatchEvent(new Event("visibilitychange"));
    expect(calls).toBe(1);
    expect(store.getSnapshot()).toBe(false);
    unsubscribe();
    doc.visibilityState = "visible"; doc.dispatchEvent(new Event("visibilitychange"));
    expect(calls).toBe(1);
  });
});
