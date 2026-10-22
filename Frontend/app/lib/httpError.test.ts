import { describe, expect, test } from "bun:test";
import { HttpError, isNotFound } from "./httpError";

describe("isNotFound: only a confirmed 404 may say 'not found' (#913)", () => {
  test("a 404 response is not found", () => {
    expect(isNotFound(new HttpError(404, "Post not found"))).toBe(true);
  });

  test("a server error is a failed load, not 'not found'", () => {
    expect(isNotFound(new HttpError(500, "boom"))).toBe(false);
    expect(isNotFound(new HttpError(503, "upstream"))).toBe(false);
  });

  test("a network failure (no response at all) is a failed load", () => {
    expect(isNotFound(new TypeError("Failed to fetch"))).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
  });

  test("keeps the status and message for callers and logs", () => {
    const e = new HttpError(404, "Profile not found");
    expect(e.status).toBe(404);
    expect(e.message).toBe("Profile not found");
    expect(e).toBeInstanceOf(Error);
  });
});
