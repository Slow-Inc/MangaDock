import { test, expect } from "bun:test";
import { rollupHealth, type Subsystem } from "./health";

const mk = (id: string, health: Subsystem["health"]): Subsystem => ({ id, label: id, kind: "dep", health });

test("all-up subsystems roll up to up", () => {
  const r = rollupHealth([mk("a", "up"), mk("b", "up")]);
  expect(r.overall).toBe("up");
  expect(r.up).toBe(2);
});

test("any down subsystem makes the whole board down", () => {
  const r = rollupHealth([mk("a", "up"), mk("b", "degraded"), mk("c", "down")]);
  expect(r.overall).toBe("down");
  expect(r.down).toBe(1);
  expect(r.degraded).toBe(1);
});

test("degraded without down rolls up to degraded", () => {
  expect(rollupHealth([mk("a", "up"), mk("b", "degraded")]).overall).toBe("degraded");
});
