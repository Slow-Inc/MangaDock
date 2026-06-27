import { describe, expect, test } from "bun:test";
import { createAuthHeaders, parseErrorResponse } from "./apiUtils";

describe("createAuthHeaders", () => {
  test("adds Bearer Authorization when token is present", () => {
    expect(createAuthHeaders("abc")).toEqual({ Authorization: "Bearer abc" });
  });

  test("omits Authorization when token is null/undefined/empty", () => {
    expect(createAuthHeaders(null)).toEqual({});
    expect(createAuthHeaders(undefined)).toEqual({});
    expect(createAuthHeaders("")).toEqual({});
  });

  test("merges extra headers and keeps Authorization", () => {
    expect(createAuthHeaders("abc", { "Content-Type": "application/json" })).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer abc",
    });
  });

  test("returns extra headers only when no token", () => {
    expect(createAuthHeaders(null, { "Content-Type": "application/json" })).toEqual({
      "Content-Type": "application/json",
    });
  });

  test("does not mutate the passed extra object", () => {
    const extra = { "Content-Type": "application/json" };
    createAuthHeaders("abc", extra);
    expect(extra).toEqual({ "Content-Type": "application/json" });
  });
});

describe("parseErrorResponse", () => {
  test("extracts string message from JSON body", async () => {
    const res = new Response(JSON.stringify({ message: "Bad input" }), { status: 400 });
    expect(await parseErrorResponse(res)).toBe("Bad input");
  });

  test("joins array message from JSON body", async () => {
    const res = new Response(JSON.stringify({ message: ["a", "b"] }), { status: 400 });
    expect(await parseErrorResponse(res)).toBe("a, b");
  });

  test("falls back to error field", async () => {
    const res = new Response(JSON.stringify({ error: "Nope" }), { status: 403 });
    expect(await parseErrorResponse(res)).toBe("Nope");
  });

  test("returns raw text when body is not JSON", async () => {
    const res = new Response("plain text error", { status: 500 });
    expect(await parseErrorResponse(res)).toBe("plain text error");
  });

  test("returns HTTP <status> when body is empty", async () => {
    const res = new Response("", { status: 502 });
    expect(await parseErrorResponse(res)).toBe("HTTP 502");
  });
});
