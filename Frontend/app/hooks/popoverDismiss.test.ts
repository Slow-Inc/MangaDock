import { describe, expect, test } from "bun:test";
import { popoverDismiss } from "./popoverDismiss";

type Node_ = { id: string; focused?: boolean; focus?: () => void };

/** A document with its own listener table and a container that "contains" a fixed set of nodes. */
function setup() {
  const listeners: Record<string, Set<(e: unknown) => void>> = {};
  const trigger: Node_ = { id: "trigger" };
  trigger.focus = () => { doc.activeElement = trigger; };
  const item: Node_ = { id: "item" };
  const outside: Node_ = { id: "outside" };
  const inside = new Set<Node_>([trigger, item]);
  const container = {
    contains: (n: unknown) => inside.has(n as Node_),
    querySelector: (sel: string) => (sel === "[aria-expanded]" ? trigger : null),
  };
  const doc = {
    activeElement: item as Node_ | null,
    addEventListener: (t: string, fn: (e: unknown) => void) => { (listeners[t] ??= new Set()).add(fn); },
    removeEventListener: (t: string, fn: (e: unknown) => void) => { listeners[t]?.delete(fn); },
  };
  const fire = (t: string, e: unknown) => listeners[t]?.forEach((fn) => fn(e));
  let closed = 0;
  const stop = popoverDismiss(doc as never, () => container as never, () => { closed++; });
  return { doc, fire, trigger, item, outside, stop, closed: () => closed };
}

describe("popoverDismiss: Navbar popovers close by keyboard as well as mouse (#870)", () => {
  test("Escape closes and returns focus to the trigger when focus was inside", () => {
    const s = setup();
    s.fire("keydown", { key: "Escape" });
    expect(s.closed()).toBe(1);
    expect(s.doc.activeElement).toBe(s.trigger);
  });

  test("Escape with focus elsewhere closes without stealing focus", () => {
    const s = setup();
    s.doc.activeElement = s.outside;
    s.fire("keydown", { key: "Escape" });
    expect(s.closed()).toBe(1);
    expect(s.doc.activeElement).toBe(s.outside);
  });

  test("a mousedown outside closes; inside does not; other keys do nothing", () => {
    const s = setup();
    s.fire("mousedown", { target: s.item });
    s.fire("keydown", { key: "Tab" });
    expect(s.closed()).toBe(0);
    s.fire("mousedown", { target: s.outside });
    expect(s.closed()).toBe(1);
  });

  test("stops listening once the popover is closed", () => {
    const s = setup();
    s.stop();
    s.fire("keydown", { key: "Escape" });
    s.fire("mousedown", { target: s.outside });
    expect(s.closed()).toBe(0);
  });
});
