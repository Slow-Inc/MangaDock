import { test, expect } from "bun:test";
import { MIT_TABS, tabForHash } from "./service-tabs";

// Behaviour: the MIT detail page (/service/mit) is organised into tabs (IA #304); the overview deep-links
// to a panel via a URL hash (e.g. #vram, #queue) and the page opens the tab that holds it.

test("MIT detail has the IA tabs in order (logs/console moved to the per-node popup)", () => {
  expect(MIT_TABS.map((t) => t.id)).toEqual(["pipeline", "telemetry", "queue", "workers"]);
});

test("a panel hash resolves to the tab that holds it", () => {
  expect(tabForHash("#queue")).toBe("queue");
  expect(tabForHash("#vram")).toBe("telemetry"); // vram lives under telemetry
  expect(tabForHash("#gateway")).toBe("pipeline");
  expect(tabForHash("#gpu")).toBe("telemetry");
});

test("logs/console are no longer MIT tabs (per-node popup) → fall back to the first tab", () => {
  expect(tabForHash("#logs")).toBe("pipeline");
  expect(tabForHash("#console")).toBe("pipeline");
});

test("empty or unknown hash defaults to the first tab", () => {
  expect(tabForHash("")).toBe("pipeline");
  expect(tabForHash("#")).toBe("pipeline");
  expect(tabForHash("#bogus")).toBe("pipeline");
});

test("a hash may omit the leading #", () => {
  expect(tabForHash("workers")).toBe("workers");
});
