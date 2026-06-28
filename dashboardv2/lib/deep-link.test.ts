import { test, expect } from "bun:test";
import { subsystemLink, targetForKind, INCIDENT_TARGET } from "./deep-link";

test("subsystem with a destination → its view/tab", () => {
  expect(subsystemLink("Frontend")).toEqual({ view: "Frontend" });
  expect(subsystemLink("Backend")).toEqual({ view: "Backend" });
  expect(subsystemLink("MIT")).toEqual({ view: "MIT", tab: "telemetry" });
  expect(subsystemLink("9arm gateway")).toEqual({ view: "MIT", tab: "pipeline" });
});

test("subsystem with no own view → null (so the pill is not a false affordance)", () => {
  expect(subsystemLink("Redis · L2")).toBeNull();
  expect(subsystemLink("Supabase")).toBeNull();
  expect(subsystemLink("Cloudflare R2")).toBeNull();
  expect(subsystemLink("Streams")).toBeNull();
  expect(subsystemLink("nonsense")).toBeNull();
});

test("incident detail lands on the MIT pipeline tab", () => {
  expect(INCIDENT_TARGET).toEqual({ view: "MIT", tab: "pipeline" });
});

test("search-result kind → the MIT tab that shows it", () => {
  expect(targetForKind("stage")).toEqual({ view: "MIT", tab: "pipeline" });
  expect(targetForKind("worker")).toEqual({ view: "MIT", tab: "workers" });
  expect(targetForKind("job")).toEqual({ view: "MIT", tab: "queue" });
});
