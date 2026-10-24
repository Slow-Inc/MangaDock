import { describe, expect, test } from "bun:test";
import { applyCoinBalanceUpdate } from "./coinBalanceEvent";

describe("applyCoinBalanceUpdate", () => {
  test("an absolute balance replaces the chip value", () => {
    expect(applyCoinBalanceUpdate(10, { balance: 42 })).toBe(42);
  });

  test("a delta is added to the known balance (claim credited, refetch failed)", () => {
    expect(applyCoinBalanceUpdate(10, { delta: 5 })).toBe(15);
  });

  test("a delta on an unknown balance stays unknown rather than inventing one", () => {
    expect(applyCoinBalanceUpdate(null, { delta: 5 })).toBeNull();
  });

  test("an absolute balance wins over a delta when both are present", () => {
    expect(applyCoinBalanceUpdate(10, { balance: 42, delta: 5 })).toBe(42);
  });
});
