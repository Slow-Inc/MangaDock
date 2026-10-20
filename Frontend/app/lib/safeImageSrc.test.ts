import { describe, expect, test } from "bun:test";
import { safeImageSrc } from "./safeUrl";

describe("safeImageSrc — a user-supplied image URL, or null when it must not be loaded", () => {
  test("an http(s) or relative URL is returned trimmed", () => {
    expect(safeImageSrc(" https://cdn.example.com/a.jpg ")).toBe("https://cdn.example.com/a.jpg");
    expect(safeImageSrc("/uploads/forum/a.jpg")).toBe("/uploads/forum/a.jpg");
  });
  test("empty → null", () => {
    expect(safeImageSrc(null)).toBeNull();
    expect(safeImageSrc("  ")).toBeNull();
  });
  test("a blocked scheme → null", () => {
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
    expect(safeImageSrc("data:text/html,x")).toBeNull();
  });
});
