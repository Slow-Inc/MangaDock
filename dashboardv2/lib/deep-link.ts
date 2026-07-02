// Where a drill-down lands. The Overview surfaces (subsystem pills, incident "View detail",
// search results) need to jump to a specific view + MIT tab — not always Overview/pipeline.
// Pure mapping so the routing is unit-tested and the JSX just calls navigate(target).
// MIT tab ids mirror service-tabs.ts: pipeline · telemetry · queue · workers.

export interface DeepLinkTarget {
  view: string; // a NAV view label: Overview | Frontend | Backend | MIT
  tab?: string; // a MIT depth tab id when view === "MIT"
}

// Subsystem pill → where its detail lives. Only the subsystems that HAVE a destination
// return a target; the rest (Redis/Supabase/R2/Streams have no own view yet) return null
// so the pill drops its clickable affordance instead of being a dead `cursor-pointer`.
const SUBSYSTEM_LINKS: Record<string, DeepLinkTarget> = {
  Frontend: { view: "Frontend" },
  Backend: { view: "Backend" },
  MIT: { view: "MIT", tab: "telemetry" },
  "9arm gateway": { view: "MIT", tab: "pipeline" }, // gateway diagnosis lives in the pipeline tab
};

export function subsystemLink(label: string): DeepLinkTarget | null {
  return SUBSYSTEM_LINKS[label] ?? null;
}

// The incident banner's "View detail" / a stalled pipeline → the MIT pipeline tab (the spine + gateway).
export const INCIDENT_TARGET: DeepLinkTarget = { view: "MIT", tab: "pipeline" };

// A search result of a given kind → the MIT tab that shows it.
export function targetForKind(kind: "stage" | "worker" | "job"): DeepLinkTarget {
  if (kind === "worker") return { view: "MIT", tab: "workers" };
  if (kind === "job") return { view: "MIT", tab: "queue" };
  return { view: "MIT", tab: "pipeline" }; // stage
}
