/** Backend node-cluster status, folded from records read out of L2 (Redis).
 *  Per ADR 011 / 016: the backend runs as N nodes coordinating through Redis
 *  (leader election + pub/sub bus), so each node's heartbeat + role lives in L2
 *  and the dashboard reads it from there. Pure — unit-tested in cluster.test.ts. */

export type NodeHealth = "up" | "stale" | "down";

export interface NodeRecord {
  id: string; // nodeId (randomUUID, short form)
  isLeader: boolean; // holds the election lock
  lastSeenMs: number; // last heartbeat (epoch ms)
  l1Entries: number; // per-node in-process LRU count
  dirtyQueue?: number; // leader-only: pending L3/Supabase write-behind depth
}

export interface NodeStatus extends NodeRecord {
  status: NodeHealth;
  ageMs: number;
}

export interface ClusterSummary {
  nodes: NodeStatus[];
  leaderId: string | null; // node flagged leader (any health), null if none elected
  leaderHealthy: boolean; // a leader exists and is up
  total: number;
  live: number; // nodes currently up
  health: "healthy" | "degraded" | "down";
}

// Election cadence (cache phase 2.3): renew every 5 s, lease TTL 12.5 s.
export const NODE_STALE_MS = 6000; // one missed heartbeat
export const NODE_DOWN_MS = 12500; // lease expired → presumed dead

function nodeHealth(ageMs: number): NodeHealth {
  if (ageMs >= NODE_DOWN_MS) return "down";
  if (ageMs >= NODE_STALE_MS) return "stale";
  return "up";
}

export function summarizeCluster(nodes: NodeRecord[], now: number): ClusterSummary {
  const out: NodeStatus[] = nodes.map((n) => {
    const ageMs = now - n.lastSeenMs;
    return { ...n, ageMs, status: nodeHealth(ageMs) };
  });

  const leader = out.find((n) => n.isLeader) ?? null;
  const leaderId = leader ? leader.id : null;
  const leaderHealthy = !!leader && leader.status === "up";
  const live = out.filter((n) => n.status === "up").length;
  const total = out.length;
  const health = live === 0 ? "down" : !leaderHealthy || live < total ? "degraded" : "healthy";

  return { nodes: out, leaderId, leaderHealthy, total, live, health };
}
