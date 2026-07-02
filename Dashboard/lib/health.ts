/** Subsystem / dependency health rollup. Pure — unit-tested in health.test.ts.
 *  Per ADR 016 §1b: a board of subsystem health so the broken one is visible at a glance. */

export type Health = "up" | "degraded" | "down";

export interface Subsystem {
  id: string;
  label: string;
  kind: string; // "gateway" | "cache" | "db" | "storage" | "gpu" | "disk" ...
  health: Health;
  detail?: string;
  latencyMs?: number;
}

export interface HealthRollup {
  subsystems: Subsystem[];
  overall: Health;
  up: number;
  degraded: number;
  down: number;
}

export function rollupHealth(subsystems: Subsystem[]): HealthRollup {
  const count = (h: Health) => subsystems.filter((s) => s.health === h).length;
  const down = count("down");
  const degraded = count("degraded");
  const overall: Health = down > 0 ? "down" : degraded > 0 ? "degraded" : "up";
  return { subsystems, overall, up: count("up"), degraded, down };
}
