import { test, expect } from "bun:test";
import { summarizeBandwidth, type BwService, type BwNode } from "./bandwidth";

const services: BwService[] = [
  { id: "fe", name: "Frontend", color: "x", down: 80, up: 20 }, // 100
  { id: "be", name: "Backend", color: "x", down: 40, up: 20 }, // 60
  { id: "mit", name: "MIT", color: "x", down: 30, up: 10 }, // 40
];
const nodes: BwNode[] = [
  { nodeId: "n1", down: 24, up: 12 }, // 36
  { nodeId: "n2", down: 16, up: 8 }, // 24
];

test("totals sum down/up across services", () => {
  const b = summarizeBandwidth(services, nodes);
  expect(b.totalDown).toBe(150);
  expect(b.totalUp).toBe(50);
  expect(b.total).toBe(200);
});

test("each service carries its share of overall traffic", () => {
  const b = summarizeBandwidth(services, nodes);
  expect(b.services.find((s) => s.id === "fe")!.pct).toBe(50);
  expect(b.services.find((s) => s.id === "mit")!.pct).toBe(20);
});

test("backend bandwidth is the sum of its nodes", () => {
  const b = summarizeBandwidth(services, nodes);
  expect(b.backendDown).toBe(40);
  expect(b.backendUp).toBe(20);
});

test("each node carries its share within the backend", () => {
  const b = summarizeBandwidth(services, nodes);
  expect(b.nodes.find((n) => n.nodeId === "n1")!.pct).toBe(60);
  expect(b.nodes.find((n) => n.nodeId === "n2")!.pct).toBe(40);
});

test("order is preserved", () => {
  expect(summarizeBandwidth(services, nodes).services.map((s) => s.id)).toEqual(["fe", "be", "mit"]);
});
