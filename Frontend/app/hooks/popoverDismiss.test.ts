import { describe, expect, test } from "bun:test";
import { popoverDismiss } from "./popoverDismiss";

type Node_ = { id: string; focus?: () => void; closest?: (sel: string) => unknown };

/** A document with its own listener table and a container that "contains" a fixed set of nodes. */
function setup() {
  const listeners: Record<string, Set<(e: unknown) => void>> = {};
  const trigger: Node_ = { id: "trigger" };
  trigger.focus = () => { doc.activeElement = trigger; };
  const item: Node_ = { id: "item" };
  const outside: Node_ = { id: "outside", closest: () => null };
  const inDialog: Node_ = { id: "in-dialog", closest: () => ({ id: "dialog" }) };
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
  const fire = (t: string, e: object) => listeners[t]?.forEach((fn) => fn({ preventDefault() {}, ...e }));
  let closed = 0;
  const stop = popoverDismiss(doc as never, () => container as never, () => { closed++; });
  return { doc, fire, trigger, item, outside, inDialog, stop, closed: () => closed };
}

describe("popoverDismiss: Navbar popovers close by keyboard as well as mouse (#870)", () => {
  test("Escape closes and returns focus to the trigger when focus was inside", () => {
    const s = setup();
    s.fire("keydown", { key: "Escape" });
    expect(s.closed()).toBe(1);
    expect(s.doc.activeElement).toBe(s.trigger);
  });

  test("Escape with focus elsewhere on the page closes without stealing focus", () => {
    const s = setup();
    s.doc.activeElement = s.outside;
    s.fire("keydown", { key: "Escape" });
    expect(s.closed()).toBe(1);
    expect(s.doc.activeElement).toBe(s.outside);
  });

  test("Escape inside a dialog opened meanwhile belongs to the dialog, not the popover", () => {
    const s = setup();
    s.doc.activeElement = s.inDialog;
    s.fire("keydown", { key: "Escape" });
    expect(s.closed()).toBe(0);
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

describe("popoverDismiss inside a dialog: one Escape closes the popover only (#1073)", () => {
  test("the Escape that closes the popover is consumed, so the dialog around it stays open", () => {
    const s = setup();
    let prevented = false;
    s.fire("keydown", { key: "Escape", preventDefault: () => { prevented = true; } });
    expect(s.closed()).toBe(1);
    expect(prevented).toBe(true);
  });
  test("an Escape it leaves to a dialog is not consumed", () => {
    const s = setup();
    s.doc.activeElement = s.inDialog;
    let prevented = false;
    s.fire("keydown", { key: "Escape", preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(false);
  });
});
