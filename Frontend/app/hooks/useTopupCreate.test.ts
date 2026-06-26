import { describe, it, expect } from "bun:test";
import { computeEffectiveAmount, TIERS } from "./useTopupCreate";

describe("computeEffectiveAmount", () => {
  it("uses selected tier when not custom", () => {
    expect(computeEffectiveAmount(100, "", false)).toBe(100);
    expect(computeEffectiveAmount(500, "999", false)).toBe(500);
  });

  it("parses custom amount when useCustom is true", () => {
    expect(computeEffectiveAmount(100, "250", true)).toBe(250);
    expect(computeEffectiveAmount(50, "20", true)).toBe(20);
  });

  it("returns 0 for empty custom input", () => {
    expect(computeEffectiveAmount(100, "", true)).toBe(0);
  });

  it("returns 0 for non-numeric custom input", () => {
    expect(computeEffectiveAmount(100, "abc", true)).toBe(0);
  });
});

describe("canProceed (effectiveAmount >= 20)", () => {
  it("is false when effectiveAmount < 20", () => {
    expect(computeEffectiveAmount(100, "15", true) >= 20).toBe(false);
    expect(computeEffectiveAmount(100, "0", true) >= 20).toBe(false);
    expect(computeEffectiveAmount(100, "", true) >= 20).toBe(false);
  });

  it("is true when effectiveAmount >= 20", () => {
    expect(computeEffectiveAmount(100, "20", true) >= 20).toBe(true);
    expect(computeEffectiveAmount(50, "", false) >= 20).toBe(true);
  });

  it("all preset tiers satisfy canProceed", () => {
    for (const t of TIERS) {
      expect(computeEffectiveAmount(t, "", false) >= 20).toBe(true);
    }
  });
});
