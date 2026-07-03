// The authoritative live-or-"No Data" layer for the Dashboard redesign (#304 / I1 #305).
// Every panel reads its data through this: `isNoData(value)` decides whether to render the
// real value or the <NoData> placeholder, and `panelSource(id)` classifies where each
// surface's data comes from (so the design never shows data a panel has no source for).
// Pure — unit-tested in panel-source.test.ts; design-agnostic (no visual dependency).

/** True when a value represents an absence of data (null / undefined / empty array /
 *  blank string). NOTE: 0 and other real values are data, not absence — a queue depth of
 *  0 or 0% GPU must render the number, never "No Data". */
export function isNoData(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

export type PanelSource = "mit-live" | "mixed" | "no-source";

// Surfaces MIT reports directly via the status stream → fully live (or "No Data" until a
// translate populates run-gated telemetry like stages/vram/queue).
const MIT_LIVE = new Set<string>([
  "gpu", "host", "vram", "gateway", "queue", "workers",
  "stage-timing", "mit-feed", "gpu-detail", "worker-lifecycle", "translate-queue", "mit-console",
]);

// Overview panels whose items resolve individually — MIT items live, the rest "No Data".
const MIXED = new Set<string>(["system-flow", "subsystem-board", "pipeline"]);

/** Where a panel/surface's data comes from. Unknown ids fall back to `no-source` — the
 *  fail-safe: an unclassified surface shows "No Data" rather than ever over-claiming live
 *  data it has no feed for. Frontend/Backend/traffic/streams/incidents/etc. are no-source
 *  until #282/#283 land. */
export function panelSource(id: string): PanelSource {
  if (MIT_LIVE.has(id)) return "mit-live";
  if (MIXED.has(id)) return "mixed";
  return "no-source";
}
