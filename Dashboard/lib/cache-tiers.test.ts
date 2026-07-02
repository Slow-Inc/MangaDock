import { test, expect } from "bun:test";
import { summarizeCacheTiers, formatAge, type CacheTiersInput } from "./cache-tiers";

const NOW = 1_000_000;

const input: CacheTiersInput = {
  l2: { updatedMs: NOW - 1100, entries: 12908 },
  nodes: [
    { nodeId: "be-1", l1: { updatedMs: NOW - 400, entries: 8421, bytes: 41_000_000 }, l3: { updatedMs: NOW - 3200, files: 9210, bytes: 512_000_000, dirtyPending: 3 } },
    { nodeId: "be-2", l1: { updatedMs: NOW - 1500, entries: 8390, bytes: 40_600_000 }, l3: { updatedMs: NOW - 4000, files: 9180, bytes: 510_000_000, dirtyPending: 0 } },
  ],
};

test("L2 age is derived from its last update", () => {
  expect(summarizeCacheTiers(input, NOW).l2.ageMs).toBe(1100);
});

test("each node carries its own L1 and L3 update age", () => {
  const be1 = summarizeCacheTiers(input, NOW).nodes[0];
  expect(be1.l1.ageMs).toBe(400);
  expect(be1.l3.ageMs).toBe(3200);
});

test("L3 totals sum across nodes (the per-node disk tier)", () => {
  const t = summarizeCacheTiers(input, NOW).totals;
  expect(t.l3Files).toBe(18390);
  expect(t.l3Bytes).toBe(1_022_000_000);
});

test("node order is preserved", () => {
  expect(summarizeCacheTiers(input, NOW).nodes.map((n) => n.nodeId)).toEqual(["be-1", "be-2"]);
});

test("formatAge renders sub-second, seconds, and minutes", () => {
  expect(formatAge(400)).toBe("just now");
  expect(formatAge(3200)).toBe("3.2s ago");
  expect(formatAge(65000)).toBe("1.1m ago");
});
