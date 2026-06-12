/**
 * Tests for the zero-trust device-header injection (#227).
 * Runs with `bun test` — pure functions, no DOM/network.
 */
import { expect, test } from "bun:test";
import { isApiRequest, withZeroTrustHeaders } from "./zeroTrustHeaders";

const get = (init: RequestInit, name: string) =>
  new Headers(init.headers).get(name);

test("isApiRequest matches relative + localhost + supabase URLs only", () => {
  expect(isApiRequest("/api/proxy/books/translate/manga")).toBe(true);
  expect(isApiRequest("http://localhost:4001/x")).toBe(true);
  expect(isApiRequest("https://abc.supabase.co/x")).toBe(true);
  expect(isApiRequest("https://example.com/x")).toBe(false);
});

test("injects hardware id and clearance when both are present", () => {
  const out = withZeroTrustHeaders({ method: "POST" }, "hwid-1", "token-1");
  expect(get(out, "x-hardware-id")).toBe("hwid-1");
  expect(get(out, "x-captcha-clearance")).toBe("token-1");
  expect(out.method).toBe("POST");
});

test("omits clearance when no token is stored", () => {
  const out = withZeroTrustHeaders(undefined, "hwid-1", null);
  expect(get(out, "x-hardware-id")).toBe("hwid-1");
  expect(get(out, "x-captcha-clearance")).toBeNull();
});

test("does not clobber auth headers the caller already set", () => {
  const out = withZeroTrustHeaders(
    {
      headers: {
        "x-hardware-id": "explicit-hw",
        "x-captcha-clearance": "explicit-tok",
      },
    },
    "hwid-1",
    "token-1",
  );
  expect(get(out, "x-hardware-id")).toBe("explicit-hw");
  expect(get(out, "x-captcha-clearance")).toBe("explicit-tok");
});

test("preserves existing non-auth headers", () => {
  const out = withZeroTrustHeaders(
    { headers: { "Content-Type": "application/json" } },
    "hwid-1",
    "token-1",
  );
  expect(get(out, "content-type")).toBe("application/json");
  expect(get(out, "x-hardware-id")).toBe("hwid-1");
});
