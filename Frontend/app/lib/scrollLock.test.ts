import { describe, expect, test } from "bun:test";
import { createScrollLock } from "./scrollLock";

describe("createScrollLock (#936)", () => {
  test("locks on the first hold and unlocks on its release", () => {
    const style = { overflow: "" };
    const lock = createScrollLock(style);
    const release = lock();
    expect(style.overflow).toBe("hidden");
    release();
    expect(style.overflow).toBe("");
  });

  test("stays locked until the last holder releases (the reader closing under the popup)", () => {
    const style = { overflow: "" };
    const lock = createScrollLock(style);
    const popup = lock();
    const reader = lock();
    reader();
    expect(style.overflow).toBe("hidden");
    popup();
    expect(style.overflow).toBe("");
  });

  test("a release is counted once, however often it is called", () => {
    const style = { overflow: "" };
    const lock = createScrollLock(style);
    const popup = lock();
    const reader = lock();
    reader();
    reader();
    expect(style.overflow).toBe("hidden");
    popup();
    expect(style.overflow).toBe("");
  });

  test("releases in any order", () => {
    const style = { overflow: "" };
    const lock = createScrollLock(style);
    const first = lock();
    const second = lock();
    first();
    expect(style.overflow).toBe("hidden");
    second();
    expect(style.overflow).toBe("");
  });
});
