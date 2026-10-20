import { describe, expect, test } from "bun:test";
import { safeUrl } from "./safeUrl";

describe("safeUrl", () => {
  test("keeps an https URL (trimmed)", () => {
    expect(safeUrl("  https://cdn.example.com/a.png ")).toBe("https://cdn.example.com/a.png");
  });

  test.each(["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd"])(
    "neutralises dangerous scheme %p to #",
    (url) => {
      expect(safeUrl(url)).toBe("#");
    },
  );
});
