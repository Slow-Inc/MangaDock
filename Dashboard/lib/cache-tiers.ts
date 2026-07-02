/** L1 / L2 / L3 cache-tier status with last-update ages. Pure — unit-tested in cache-tiers.test.ts.
 *  Per ADR 011: L1 = in-process LRU (per node), L2 = Redis (shared source of truth),
 *  L3 = disk (per node). Each tier reports its own last-update time; L1 and L3 are read per node. */

export interface L1Stat {
  updatedMs: number;
  entries: number;
  bytes: number;
}

export interface L3Stat {
  updatedMs: number;
  files: number;
  bytes: number;
  dirtyPending: number;
}

export interface L2Stat {
  updatedMs: number;
  entries: number;
}

export interface NodeCacheRecord {
  nodeId: string;
  l1: L1Stat;
  l3: L3Stat;
}

export interface CacheTiersInput {
  l2: L2Stat;
  nodes: NodeCacheRecord[];
}

export interface NodeCacheStatus {
  nodeId: string;
  l1: L1Stat & { ageMs: number };
  l3: L3Stat & { ageMs: number };
}

export interface CacheTiersSummary {
  l2: L2Stat & { ageMs: number };
  nodes: NodeCacheStatus[];
  totals: { l1Entries: number; l3Files: number; l3Bytes: number };
}

export function summarizeCacheTiers(input: CacheTiersInput, now: number): CacheTiersSummary {
  const nodes: NodeCacheStatus[] = input.nodes.map((n) => ({
    nodeId: n.nodeId,
    l1: { ...n.l1, ageMs: now - n.l1.updatedMs },
    l3: { ...n.l3, ageMs: now - n.l3.updatedMs },
  }));

  return {
    l2: { ...input.l2, ageMs: now - input.l2.updatedMs },
    nodes,
    totals: {
      l1Entries: nodes.reduce((s, n) => s + n.l1.entries, 0),
      l3Files: nodes.reduce((s, n) => s + n.l3.files, 0),
      l3Bytes: nodes.reduce((s, n) => s + n.l3.bytes, 0),
    },
  };
}

/** Human-friendly "updated N ago". */
export function formatAge(ms: number): string {
  if (ms < 1000) return "just now";
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s ago`;
  return `${(ms / 60000).toFixed(1)}m ago`;
}
