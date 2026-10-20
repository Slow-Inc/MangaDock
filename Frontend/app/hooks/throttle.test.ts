import { describe, expect, test } from "bun:test";
import { throttleDelay } from "./throttle";

describe("throttleDelay", () => {
  test("the first value goes out at once", () => {
    expect(throttleDelay(null, 1000, 100)).toBe(0);
  });
  test("a value inside the interval waits for the rest of it", () => {
    expect(throttleDelay(1000, 1030, 100)).toBe(70);
  });
  test("a value after the interval goes out at once", () => {
    expect(throttleDelay(1000, 1100, 100)).toBe(0);
    expect(throttleDelay(1000, 1250, 100)).toBe(0);
  });
});
