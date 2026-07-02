import { describe, it, expect, afterEach } from "bun:test";
import { probeService } from "./service-status";

const originalFetch = global.fetch;

describe("probeService", () => {
  afterEach(() => { global.fetch = originalFetch; });

  it("returns the parsed snapshot on HTTP 200", async () => {
    const snapshot = {
      schemaVersion: 1, service: "backend", status: "up", reason: "all checks passed",
      checks: [], uptimeSec: 100, durationMs: 12, checkedAt: "2026-07-02T00:00:00.000Z",
    };
    global.fetch = async () => new Response(JSON.stringify(snapshot), { status: 200 }) as Response;
    const result = await probeService("http://localhost:3001/status", "backend");
    expect(result.status).toBe("up");
    expect(result.service).toBe("backend");
    expect(result.schemaVersion).toBe(1);
  });

  it("returns status:down when fetch throws (timeout / unreachable)", async () => {
    global.fetch = async () => { throw new Error("AbortError"); };
    const result = await probeService("http://localhost:3001/status", "backend");
    expect(result.status).toBe("down");
    expect(result.service).toBe("backend");
    expect(result.schemaVersion).toBe(1);
  });

  it("returns status:down when response is non-200", async () => {
    global.fetch = async () => new Response("Bad Gateway", { status: 502 }) as Response;
    const result = await probeService("http://localhost:3001/status", "backend");
    expect(result.status).toBe("down");
    expect(result.reason).toContain("502");
  });
});
