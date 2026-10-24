import { describe, expect, test } from "bun:test";
import { focusMain } from "./SkipLink";

/** The slice of a <main> element focusMain touches. */
function fakeMain(attrs: Record<string, string> = {}) {
  const el = {
    attrs: { ...attrs },
    focused: false,
    hasAttribute: (n: string) => n in el.attrs,
    setAttribute: (n: string, v: string) => { el.attrs[n] = v; },
    focus: () => { el.focused = true; },
  };
  return el;
}

describe("focusMain: the skip link lands keyboard focus on the content (#856)", () => {
  test("focuses the page's <main>, making it focusable without adding it to the Tab order", () => {
    const main = fakeMain();
    expect(focusMain({ querySelector: () => main })).toBe(true);
    expect(main.attrs.tabindex).toBe("-1");
    expect(main.focused).toBe(true);
  });

  test("keeps a tabindex the page already set", () => {
    const main = fakeMain({ tabindex: "0" });
    focusMain({ querySelector: () => main });
    expect(main.attrs.tabindex).toBe("0");
  });

  test("reports false when the page has no <main>, so the link falls back to its #main href", () => {
    expect(focusMain({ querySelector: () => null })).toBe(false);
  });
});
