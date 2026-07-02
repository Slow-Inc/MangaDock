import { test, expect } from "bun:test";
import { summarizeCluster, type NodeRecord } from "./cluster";

const NOW = 1_000_000;

const healthy: NodeRecord[] = [
  { id: "be-1", isLeader: true, lastSeenMs: NOW - 1000, l1Entries: 8400, dirtyQueue: 2 },
  { id: "be-2", isLeader: false, lastSeenMs: NOW - 2000, l1Entries: 8390 },
  { id: "be-3", isLeader: false, lastSeenMs: NOW - 3000, l1Entries: 8350 },
];

test("a live cluster with a fresh leader is healthy", () => {
  const c = summarizeCluster(healthy, NOW);
  expect(c.health).toBe("healthy");
  expect(c.leaderId).toBe("be-1");
  expect(c.leaderHealthy).toBe(true);
  expect(c.live).toBe(3);
  expect(c.total).toBe(3);
});

test("node age is derived from its last heartbeat", () => {
  const c = summarizeCluster(healthy, NOW);
  expect(c.nodes.find((n) => n.id === "be-1")!.ageMs).toBe(1000);
});

test("a follower past the stale threshold is marked stale and degrades the cluster", () => {
  const lagging = [...healthy.slice(0, 2), { ...healthy[2], lastSeenMs: NOW - 8000 }];
  const c = summarizeCluster(lagging, NOW);
  expect(c.nodes.find((n) => n.id === "be-3")!.status).toBe("stale");
  expect(c.live).toBe(2);
  expect(c.health).toBe("degraded");
});

test("a leader past the lease TTL counts as down and the cluster degrades", () => {
  const c = summarizeCluster([{ ...healthy[0], lastSeenMs: NOW - 13000 }, healthy[1], healthy[2]], NOW);
  expect(c.nodes.find((n) => n.id === "be-1")!.status).toBe("down");
  expect(c.leaderHealthy).toBe(false);
  expect(c.health).toBe("degraded");
});

test("when no node is up the cluster is down", () => {
  const c = summarizeCluster(healthy.map((n) => ({ ...n, lastSeenMs: NOW - 20000 })), NOW);
  expect(c.live).toBe(0);
  expect(c.health).toBe("down");
});

test("a cluster with no elected leader is degraded even if every node is live", () => {
  const c = summarizeCluster(healthy.map((n) => ({ ...n, isLeader: false })), NOW);
  expect(c.leaderId).toBeNull();
  expect(c.health).toBe("degraded");
});
