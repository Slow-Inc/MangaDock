import { test, expect, afterEach } from "bun:test";
import { isMockMode } from "./mock-mode";

// Behaviour: NEXT_PUBLIC_MOCKUP_MODE in .env.local turns on mock data for UX/UI testing while a
// real live source isn't available. Off by default so production never fakes data (#304).

const orig = process.env.NEXT_PUBLIC_MOCKUP_MODE;
afterEach(() => {
  if (orig === undefined) delete process.env.NEXT_PUBLIC_MOCKUP_MODE;
  else process.env.NEXT_PUBLIC_MOCKUP_MODE = orig;
});

test('"true" enables mock mode', () => {
  process.env.NEXT_PUBLIC_MOCKUP_MODE = "true";
  expect(isMockMode()).toBe(true);
});

test("unset disables mock mode (production default)", () => {
  delete process.env.NEXT_PUBLIC_MOCKUP_MODE;
  expect(isMockMode()).toBe(false);
});

test('any value other than "true" is off (e.g. "false", "1")', () => {
  process.env.NEXT_PUBLIC_MOCKUP_MODE = "false";
  expect(isMockMode()).toBe(false);
  process.env.NEXT_PUBLIC_MOCKUP_MODE = "1";
  expect(isMockMode()).toBe(false);
});
