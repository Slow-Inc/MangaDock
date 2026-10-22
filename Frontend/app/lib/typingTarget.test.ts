import { describe, expect, test } from "bun:test";
import { isTypingTarget } from "./typingTarget";

// Plain stand-ins for event targets: the helper reads only tagName and isContentEditable.
const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget;

describe("isTypingTarget (#928)", () => {
  test("text fields are typing targets", () => {
    expect(isTypingTarget(el("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(el("INPUT"))).toBe(true);
    expect(isTypingTarget(el("SELECT"))).toBe(true);
  });

  test("an editable element is a typing target", () => {
    expect(isTypingTarget(el("DIV", true))).toBe(true);
  });

  test("buttons, plain elements and the page are not", () => {
    expect(isTypingTarget(el("BUTTON"))).toBe(false);
    expect(isTypingTarget(el("DIV"))).toBe(false);
    expect(isTypingTarget(el("BODY"))).toBe(false);
  });

  test("no target, or one without a tag (window), is not", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({} as EventTarget)).toBe(false);
  });
});
