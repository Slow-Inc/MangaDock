/**
 * Tests for the zero-trust device-header injection (#227).
 * Runs with `bun test` — pure functions, no DOM/network.
 */
import { expect, test } from "bun:test";
import { isApiRequest, withZeroTrustHeaders } from "./zeroTrustHeaders";

const get = (init: RequestInit, name: string) =>
  new Headers(init.headers).get(name);

const ALLOWED = ["https://app.example.com", "https://abc.supabase.co"];

test("isApiRequest allows relative same-origin paths and exact allowed origins", () => {
  // Relative same-origin paths (single leading slash).
  expect(isApiRequest("/api/proxy/books/translate/manga", ALLOWED)).toBe(true);
  // Absolute URLs whose origin exactly matches an allowed origin.
  expect(isApiRequest("https://app.example.com/x", ALLOWED)).toBe(true);
  expect(isApiRequest("https://abc.supabase.co/rest/v1/foo", ALLOWED)).toBe(
    true,
  );
});

test("isApiRequest rejects substring/protocol-relative origin spoofs (#1)", () => {
  // host is evil.com, "supabase.co" only a subdomain prefix
  expect(isApiRequest("https://supabase.co.evil.com/x", ALLOWED)).toBe(false);
  // substring in query string
  expect(isApiRequest("https://evil.com/?ref=supabase.co", ALLOWED)).toBe(
    false,
  );
  // substring in fragment
  expect(isApiRequest("https://evil.com/#localhost", ALLOWED)).toBe(false);
  // substring in host
  expect(isApiRequest("https://notlocalhost.evil.com/", ALLOWED)).toBe(false);
  // protocol-relative → resolves to evil.com, must NOT count as relative
  expect(isApiRequest("//evil.com/x", ALLOWED)).toBe(false);
});

test("isApiRequest rejects unrelated absolute origins and malformed input", () => {
  expect(isApiRequest("https://example.com/x", ALLOWED)).toBe(false);
  // Malformed input must return false, never throw.
  expect(isApiRequest("http://", ALLOWED)).toBe(false);
  expect(isApiRequest("", ALLOWED)).toBe(false);
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
