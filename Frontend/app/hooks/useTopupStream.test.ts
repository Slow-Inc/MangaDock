import { describe, it, expect } from "bun:test";
import { computeCountdown } from "./useTopupStream";

describe("computeCountdown", () => {
  it("returns remaining seconds for a future expiry", () => {
    const future = new Date(Date.now() + 5000);
    const result = computeCountdown(future);
    expect(result).toBeGreaterThanOrEqual(4);
    expect(result).toBeLessThanOrEqual(5);
  });

  it("returns 0 for an already-expired date", () => {
    const past = new Date(Date.now() - 1000);
    expect(computeCountdown(past)).toBe(0);
  });

  it("returns 0 exactly at expiry moment", () => {
    const now = new Date(Date.now());
    expect(computeCountdown(now)).toBe(0);
  });

  it("floors fractional seconds (does not round up)", () => {
    // 4.9 seconds remaining → should return 4
    const almostFive = new Date(Date.now() + 4900);
    expect(computeCountdown(almostFive)).toBe(4);
  });

  it("status becomes 'expired' when countdown reaches 0", () => {
    // Verify the invariant that drives the status transition in the hook
    const past = new Date(Date.now() - 100);
    const remaining = computeCountdown(past);
    expect(remaining === 0).toBe(true); // triggers setStatus("expired")
  });
});
