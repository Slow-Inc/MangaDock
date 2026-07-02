import { describe, expect, it } from "bun:test";
import { computeEffectiveAmount } from "../hooks/useTopupCreate";
import { computeCountdown } from "../hooks/useTopupStream";

describe("computeEffectiveAmount", () => {
  it("returns tier when not custom", () => {
    expect(computeEffectiveAmount(100, "", false)).toBe(100);
    expect(computeEffectiveAmount(500, "99", false)).toBe(500);
  });
  it("parses custom amount when useCustom=true", () => {
    expect(computeEffectiveAmount(100, "250", true)).toBe(250);
  });
  it("returns 0 for empty custom (blocks proceed)", () => {
    expect(computeEffectiveAmount(100, "", true)).toBe(0);
  });
  it("returns 0 for non-numeric custom", () => {
    expect(computeEffectiveAmount(100, "abc", true)).toBe(0);
  });
  it("canProceed threshold: 19 fails, 20 passes", () => {
    expect(computeEffectiveAmount(100, "19", true) >= 20).toBe(false);
    expect(computeEffectiveAmount(100, "20", true) >= 20).toBe(true);
  });
});

describe("computeCountdown", () => {
  it("returns 0 for past expiry", () => {
    expect(computeCountdown(new Date(Date.now() - 5000))).toBe(0);
  });
  it("returns positive seconds for future expiry", () => {
    const result = computeCountdown(new Date(Date.now() + 60_000));
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(60);
  });
});
