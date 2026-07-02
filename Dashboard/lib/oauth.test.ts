import { test, expect } from "bun:test";
import { mapOAuthError } from "./oauth";

test("identity_already_exists → already linked elsewhere", () => {
  expect(mapOAuthError("identity_already_exists", "")).toMatch(/already linked|เชื่อม/i);
});

test("email_exists → use the existing provider", () => {
  expect(mapOAuthError("email_exists", "")).toMatch(/already has an account|มีบัญชี/i);
});

test("the linking-domain conflict points the user to sign in then link", () => {
  // The real error from a fresh GitHub sign-in onto an existing email account.
  const msg = mapOAuthError("", "Multiple accounts with the same email address in the same linking domain detected: default");
  expect(msg).toMatch(/sign in with your existing|เข้าด้วย.*แล้ว.*เชื่อม|link/i);
});

test("falls back to the raw description when unmapped", () => {
  expect(mapOAuthError("", "some other problem")).toBe("some other problem");
});

test("empty input → a generic message", () => {
  expect(mapOAuthError("", "")).toMatch(/sign-in|เข้าสู่ระบบ|failed/i);
});
