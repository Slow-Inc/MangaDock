// Functional console search — filters the live snapshot's stages / workers / jobs by a query
// and returns matches with a deep-link target so the topbar dropdown can jump to each. Pure so
// it is unit-tested in isolation; the topbar input just renders `searchSnapshot(m, q)`.

import type { MitLive } from "./live-map";
import { targetForKind, type DeepLinkTarget } from "./deep-link";

export interface SearchResult {
  kind: "stage" | "worker" | "job";
  label: string; // primary text (stage name / worker id / job task)
  sub: string; // secondary detail (timing / pid / state)
  target: DeepLinkTarget;
}

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle);

// Matches across the three live collections. Empty/whitespace query → no results (the dropdown hides).
// `limit` caps the dropdown so a broad query can't render an unbounded list.
export function searchSnapshot(m: MitLive | null, query: string, limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!m || !q) return [];
  const out: SearchResult[] = [];

  for (const s of m.stages ?? []) {
    if (has(s.label, q) || has(s.id, q)) {
      out.push({ kind: "stage", label: s.label, sub: s.liveMs === 0 ? "idle" : `${Math.round(s.liveMs / 100) / 10}s`, target: targetForKind("stage") });
    }
  }
  for (const w of m.workersDetail ?? []) {
    const id = `w-${w.port}`;
    if (has(id, q) || has(w.ip, q) || (w.pid != null && has(String(w.pid), q))) {
      out.push({ kind: "worker", label: id, sub: `${w.ip}:${w.port} · ${w.busy ? "busy" : "idle"}`, target: targetForKind("worker") });
    }
  }
  for (const j of m.queueJobs ?? []) {
    const task = j.taskId ?? "";
    if (has(task, q) || has(j.taskType, q) || has(j.state, q)) {
      out.push({ kind: "job", label: task || j.id, sub: `${j.taskType} · ${j.state}`, target: targetForKind("job") });
    }
  }
  return out.slice(0, limit);
}
