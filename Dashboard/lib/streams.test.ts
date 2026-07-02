import { test, expect } from "bun:test";
import { summarizeStreams, type StreamConn } from "./streams";

const NOW = 1_000_000;

const streams: StreamConn[] = [
  { service: "frontend", state: "connected", lastEventMs: NOW - 1200, revalidatedMs: NOW - 8000 },
  { service: "backend", state: "connected", lastEventMs: NOW - 800, revalidatedMs: NOW - 54000 }, // expiry soon
  { service: "mit", state: "reconnecting", lastEventMs: NOW - 30000, revalidatedMs: NOW - 30000 },
];

test("all-connected streams are healthy", () => {
  const allUp = streams.slice(0, 2);
  expect(summarizeStreams(allUp, NOW).overall).toBe("healthy");
});

test("a reconnecting stream degrades the data plane", () => {
  const s = summarizeStreams(streams, NOW);
  expect(s.connected).toBe(2);
  expect(s.total).toBe(3);
  expect(s.overall).toBe("degraded");
});

test("a connection past 80% of the re-validate window is flagged expiry-soon", () => {
  const s = summarizeStreams(streams, NOW);
  expect(s.streams.find((x) => x.service === "backend")!.expirySoon).toBe(true);
  expect(s.streams.find((x) => x.service === "frontend")!.expirySoon).toBe(false);
});

test("time since last event is derived", () => {
  expect(summarizeStreams(streams, NOW).streams[0].sinceEventMs).toBe(1200);
});
