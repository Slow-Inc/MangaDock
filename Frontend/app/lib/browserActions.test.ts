import { test, expect, mock, beforeEach, afterEach } from "bun:test";
import { reloadPage, redirectToHome } from "./browserActions";

const savedWindow = (globalThis as Record<string, unknown>).window;

let reloadMock = mock(() => {});
let replaceMock = mock(() => {});

beforeEach(() => {
  reloadMock = mock(() => {});
  replaceMock = mock(() => {});
  (globalThis as Record<string, unknown>).window = {
    location: { reload: reloadMock, replace: replaceMock },
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).window = savedWindow;
});

// ── reloadPage ──────────────────────────────────────────────────────────

test("reloadPage() calls window.location.reload once", () => {
  reloadPage();
  expect(reloadMock).toHaveBeenCalledTimes(1);
});

test("reloadPage() does not throw in SSR (window undefined)", () => {
  (globalThis as Record<string, unknown>).window = undefined;
  expect(() => reloadPage()).not.toThrow();
});

// ── redirectToHome ──────────────────────────────────────────────────────

test("redirectToHome() calls window.location.replace('/') once", () => {
  redirectToHome();
  expect(replaceMock).toHaveBeenCalledTimes(1);
  expect(replaceMock).toHaveBeenCalledWith("/");
});

test("redirectToHome() does not throw in SSR (window undefined)", () => {
  (globalThis as Record<string, unknown>).window = undefined;
  expect(() => redirectToHome()).not.toThrow();
});
