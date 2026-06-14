import { test, expect } from "bun:test";

import { reduce, initialState, markStale, STALE_MS } from "./snapshot";

// The dashboard subscribes to each service's `/status/stream` and folds the
// incoming messages into one live snapshot. The reducer is pure (it takes
// `now` so staleness is testable without the clock) — this is the deep module
// the UI renders from. See PRD #279 / ADR 016.

test("a metric message records the service's metrics and marks it up", () => {
  const next = reduce(
    initialState(),
    { type: "metric", service: "mit", host: { cpu_pct: 40 } },
    1000,
  );

  expect(next.services.mit.status).toBe("up");
  expect(next.services.mit.metrics?.host.cpu_pct).toBe(40);
});

test("event messages are prepended to the feed, newest first", () => {
  const s1 = reduce(
    initialState(),
    { type: "event", service: "mit", kind: "translate_triggered", detail: "Gal Yome ch1" },
    1000,
  );
  const s2 = reduce(
    s1,
    { type: "event", service: "mit", kind: "stage", detail: "ocr" },
    1001,
  );

  expect(s2.events.length).toBe(2);
  expect((s2.events[0] as { kind: string }).kind).toBe("stage");
});

test("a status message records a subsystem diagnosis and keeps the service up", () => {
  const s = reduce(
    initialState(),
    {
      type: "status",
      service: "mit",
      subsystem: "translator",
      status: "timeout",
      detail: "gateway /models OK but chat completion timed out — model not responding",
    },
    1000,
  );

  expect(s.services.mit.subsystems?.translator.status).toBe("timeout");
  expect(s.services.mit.status).toBe("up");
});

test("a service not seen within the stale window is marked stale", () => {
  const fresh = reduce(initialState(), { type: "metric", service: "mit", host: { cpu_pct: 40 } }, 1000);

  const aged = markStale(fresh, 1000 + STALE_MS + 1);

  expect(aged.services.mit.status).toBe("stale");
});

test("a recently-seen service stays up after markStale", () => {
  const fresh = reduce(initialState(), { type: "metric", service: "mit", host: {} }, 1000);

  const checked = markStale(fresh, 1000 + 1000);

  expect(checked.services.mit.status).toBe("up");
});
