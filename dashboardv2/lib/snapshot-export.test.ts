import { test, expect } from "bun:test";
import { buildSnapshotExport } from "./snapshot-export";
import { MOCK_MIT } from "./mock-live";

const AT = Date.UTC(2026, 5, 28, 9, 15, 30); // fixed → deterministic filename + payload

test("filename is filesystem-safe and timestamped", () => {
  const { filename } = buildSnapshotExport(MOCK_MIT, { at: AT, mock: true });
  expect(filename).toBe("mit-snapshot-2026-06-28T09-15-30-000.json");
  expect(filename).not.toContain(":");
});

test("payload records mode + the exact snapshot, valid JSON", () => {
  const { json } = buildSnapshotExport(MOCK_MIT, { at: AT, mock: true });
  const parsed = JSON.parse(json);
  expect(parsed.mode).toBe("mock");
  expect(parsed.exportedAt).toBe("2026-06-28T09:15:30.000Z");
  expect(parsed.snapshot.translator).toBe("custom_openai");
  expect(parsed.snapshot.queueSize).toBe(3);
});

test("live mode + null snapshot is honest, not a fake", () => {
  const { json } = buildSnapshotExport(null, { at: AT, mock: false });
  const parsed = JSON.parse(json);
  expect(parsed.mode).toBe("live");
  expect(parsed.snapshot).toBeNull();
});
