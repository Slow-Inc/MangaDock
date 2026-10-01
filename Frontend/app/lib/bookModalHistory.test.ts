import { beforeEach, describe, expect, test } from "bun:test";
import {
  bookPath,
  isModalNavigation,
  markModalNavigation,
  modalStack,
} from "./bookModalHistory";

describe("bookPath", () => {
  test("builds /book/<id>", () => {
    expect(bookPath("abc-123")).toBe("/book/abc-123");
  });

  test("keeps the current query string so pages behind that read it (search, community, mylist) still see it", () => {
    expect(bookPath("abc", "?q=Lout%20of%20Count&page=2")).toBe("/book/abc?q=Lout%20of%20Count&page=2");
  });

  test("encodes ids that are not url-safe", () => {
    expect(bookPath("a b/c")).toBe("/book/a%20b%2Fc");
  });
});

describe("modalStack (only the top-most popup answers Back)", () => {
  const a = Symbol("a");
  const b = Symbol("b");
  beforeEach(() => {
    modalStack.remove(a);
    modalStack.remove(b);
  });

  test("the most recently opened popup is on top", () => {
    modalStack.push(a);
    modalStack.push(b);
    expect(modalStack.isTop(b)).toBe(true);
    expect(modalStack.isTop(a)).toBe(false);
  });

  test("closing the top one hands Back to the one underneath", () => {
    modalStack.push(a);
    modalStack.push(b);
    modalStack.remove(b);
    expect(modalStack.isTop(a)).toBe(true);
  });

  test("an unknown or removed token is never on top", () => {
    expect(modalStack.isTop(a)).toBe(false);
    modalStack.push(a);
    modalStack.remove(a);
    expect(modalStack.isTop(a)).toBe(false);
  });

  test("removing twice is harmless", () => {
    modalStack.push(a);
    modalStack.remove(a);
    expect(() => modalStack.remove(a)).not.toThrow();
  });
});

describe("modal navigation marker (lets SmoothScrolling skip its scroll-to-top)", () => {
  test("true shortly after a popup opened or closed, false before any and after the window", () => {
    expect(isModalNavigation(5_000)).toBe(false);
    markModalNavigation(10_000);
    expect(isModalNavigation(10_500)).toBe(true);
    expect(isModalNavigation(11_500)).toBe(false);
  });
});
