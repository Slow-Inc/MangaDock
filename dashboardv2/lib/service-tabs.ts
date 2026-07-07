// Tab model for the MIT detail page (/service/mit) — the depth layer is organised into tabs instead of
// one long scroll (IA #304). The overview deep-links to a specific panel via a URL hash (#vram, #queue,
// …); `tabForHash` maps that hash to the tab that holds the panel so the page opens there. Pure + tested.

export interface ServiceTab {
  id: string;
  label: string;
}

export const MIT_TABS: ServiceTab[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "telemetry", label: "Telemetry" },
  { id: "queue", label: "Queue" },
  { id: "workers", label: "Workers" },
];

// A panel anchor → the tab that contains it. Anchors not listed (or empty) fall back to the first tab.
// Logs/Console are no longer MIT tabs — they live in the per-node popup (DESIGN.md §4), so #logs/#console
// fall through to the default.
const HASH_TO_TAB: Record<string, string> = {
  pipeline: "pipeline", gateway: "pipeline", stage: "pipeline", quality: "pipeline",
  telemetry: "telemetry", gpu: "telemetry", vram: "telemetry",
  queue: "queue",
  workers: "workers",
};

export function tabForHash(hash: string): string {
  const key = hash.replace(/^#/, "").trim().toLowerCase();
  return HASH_TO_TAB[key] ?? MIT_TABS[0].id;
}
