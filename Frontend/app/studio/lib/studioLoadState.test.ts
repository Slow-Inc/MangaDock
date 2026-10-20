import { describe, expect, test } from "bun:test";
import { studioLoadState } from "./studioLoadState";

describe("studioLoadState: zeros only when the data really is empty (#828)", () => {
  test("loading without data shows the skeleton", () => {
    expect(studioLoadState({ loading: true, failed: false, hasData: false })).toBe("loading");
  });
  test("a failed first load is an error, not an empty studio", () => {
    expect(studioLoadState({ loading: false, failed: true, hasData: false })).toBe("error");
  });
  test("cached data stays on screen when a refresh fails", () => {
    expect(studioLoadState({ loading: false, failed: true, hasData: true })).toBe("ready");
  });
  test("a successful load is ready, even when it is genuinely empty", () => {
    expect(studioLoadState({ loading: false, failed: false, hasData: false })).toBe("ready");
  });
});
