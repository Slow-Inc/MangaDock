// Export the current console snapshot as a downloadable JSON blob — for filing an incident or
// diffing state later. Pure: the wall-clock `at` is passed in (no Date.now in the lib) so the
// filename + payload are deterministic and unit-testable; the component does the actual download.

import type { MitLive } from "./live-map";

export interface SnapshotExport {
  filename: string;
  json: string;
}

// `at` = epoch ms (the component passes Date.now()). `mock` records whether this was mock or live data
// so an exported file never masquerades as real telemetry.
export function buildSnapshotExport(snapshot: MitLive | null, opts: { at: number; mock: boolean }): SnapshotExport {
  const iso = new Date(opts.at).toISOString();
  const stamp = iso.replace(/[:.]/g, "-").replace("Z", "");
  return {
    filename: `mit-snapshot-${stamp}.json`,
    json: JSON.stringify({ exportedAt: iso, mode: opts.mock ? "mock" : "live", snapshot }, null, 2),
  };
}
