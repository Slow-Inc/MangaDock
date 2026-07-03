import { test, expect } from "bun:test";
import { routeChat } from "./chat";

test("VRAM / pipeline questions route to the pipeline topic", () => {
  expect(routeChat("pipeline มีอะไรบ้าง กิน VRAM แต่ละตัวเท่าไหร่")).toBe("pipeline");
  expect(routeChat("how much VRAM does each model use?")).toBe("pipeline");
});

test("translate / MIT questions route to the translate topic", () => {
  expect(routeChat("why is translate failing?")).toBe("translate");
  expect(routeChat("is the 9arm gateway down?")).toBe("translate");
});

test("a node id routes to the node topic", () => {
  expect(routeChat("what's wrong with be-c0e5f2?")).toBe("node");
  expect(routeChat("which node is the leader?")).toBe("node");
});

test("oauth / login questions route to oauth", () => {
  expect(routeChat("show frontend oauth errors")).toBe("oauth");
  expect(routeChat("any failed google login?")).toBe("oauth");
});

test("payment questions route to payment", () => {
  expect(routeChat("is the payment gateway ok?")).toBe("payment");
});

test("backend cache questions route to backend", () => {
  expect(routeChat("backend cache health?")).toBe("backend");
});

test("traffic questions route to traffic", () => {
  expect(routeChat("how many active users right now?")).toBe("traffic");
});

test("anything else falls back to general", () => {
  expect(routeChat("hello there")).toBe("general");
});
