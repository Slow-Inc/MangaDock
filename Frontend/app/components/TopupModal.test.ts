import { describe, it, expect } from "bun:test";
import { backdropCloseable } from "./TopupModal";

describe("backdropCloseable", () => {
  it("returns false for QR_DISPLAY — backdrop must not close during active payment", () => {
    expect(backdropCloseable("QR_DISPLAY")).toBe(false);
  });

  it("returns true for TIER_SELECT — user can dismiss before paying", () => {
    expect(backdropCloseable("TIER_SELECT")).toBe(true);
  });

  it("returns true for QR_EXPIRED — QR is dead, safe to dismiss", () => {
    expect(backdropCloseable("QR_EXPIRED")).toBe(true);
  });

  it("returns true for SUCCESS — payment done, safe to dismiss", () => {
    expect(backdropCloseable("SUCCESS")).toBe(true);
  });
});
