import { describe, expect, test } from "bun:test";
import { adminGate } from "./adminGate";

describe("adminGate: what the admin layout does while auth resolves (#817)", () => {
  test("waits while the session is still loading, even though user is null", () => {
    expect(adminGate({ user: null, loading: true })).toBe("wait");
  });
  test("lets an admin (8) and a dev (9) in", () => {
    expect(adminGate({ user: { role: 8 }, loading: false })).toBe("allow");
    expect(adminGate({ user: { role: 9 }, loading: false })).toBe("allow");
  });
  test("sends a signed-out visitor or a non-admin home once loading is done", () => {
    expect(adminGate({ user: null, loading: false })).toBe("redirect");
    expect(adminGate({ user: { role: 1 }, loading: false })).toBe("redirect");
    expect(adminGate({ user: { role: null }, loading: false })).toBe("redirect");
  });
});
