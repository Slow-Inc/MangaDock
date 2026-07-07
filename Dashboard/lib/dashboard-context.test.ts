import { test, expect } from "bun:test";
import { buildDashboardContext } from "./dashboard-context";

test("the context includes every major data source the AI should ground on", () => {
  const ctx = buildDashboardContext();
  // services + logs
  expect(ctx).toContain("Frontend");
  expect(ctx).toContain("MIT");
  // gateway diagnosis
  expect(ctx).toContain("Translate gateway");
  // per-node + node logs (the stale node's lease failure must be present)
  expect(ctx).toContain("be-c0e5f2");
  expect(ctx).toContain("lease renew failed");
  // VRAM per model
  expect(ctx).toContain("VRAM by model");
  expect(ctx).toContain("AnimeText YOLO");
  // subsystems incl. payment
  expect(ctx).toContain("Payment gateway");
  // traffic
  expect(ctx).toContain("active users");
});

test("a stuck queue job is surfaced", () => {
  expect(buildDashboardContext()).toContain("STUCK");
});
