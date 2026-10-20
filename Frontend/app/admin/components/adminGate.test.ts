import { describe, expect, test } from "bun:test";
import { adminGate } from "./adminGate";

// profileRole: the authoritative profiles.role from GET /users/me — undefined while that request is in flight.
describe("adminGate: what the admin layout does while auth resolves (#817)", () => {
  test("waits while the session is still loading, even though user is null", () => {
    expect(adminGate({ user: null, loading: true, profileRole: undefined })).toBe("wait");
  });
  test("lets in an admin whose JWT metadata already carries the role", () => {
    expect(adminGate({ user: { role: 8 }, loading: false, profileRole: undefined })).toBe("allow");
  });
  test("waits for the profile when the JWT has no admin role (promoted in the panel: profiles.role only)", () => {
    expect(adminGate({ user: { role: null }, loading: false, profileRole: undefined })).toBe("wait");
    expect(adminGate({ user: { role: 1 }, loading: false, profileRole: undefined })).toBe("wait");
  });
  test("follows the profile once it arrives", () => {
    expect(adminGate({ user: { role: null }, loading: false, profileRole: 8 })).toBe("allow");
    expect(adminGate({ user: { role: 1 }, loading: false, profileRole: 9 })).toBe("allow");
    expect(adminGate({ user: { role: 1 }, loading: false, profileRole: 1 })).toBe("redirect");
    expect(adminGate({ user: { role: 1 }, loading: false, profileRole: null })).toBe("redirect");
  });
  test("sends a signed-out visitor home once loading is done", () => {
    expect(adminGate({ user: null, loading: false, profileRole: undefined })).toBe("redirect");
  });
});
