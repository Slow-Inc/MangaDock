import { expect, test, describe } from "bun:test";
import { sanitizeDocsUrl } from "./utils";

describe("sanitizeDocsUrl", () => {
  test("neutralizes javascript: URLs", () => {
    expect(sanitizeDocsUrl("javascript:alert(1)")).toBe("#");
    expect(sanitizeDocsUrl("  JavaScript:alert(1)")).toBe("#");
  });

  test("neutralizes data:, vbscript:, and file: URLs", () => {
    expect(sanitizeDocsUrl("data:text/html,<script>1</script>")).toBe("#");
    expect(sanitizeDocsUrl("vbscript:msgbox(1)")).toBe("#");
    expect(sanitizeDocsUrl("file:///etc/passwd")).toBe("#");
  });

  test("passes http, https, mailto, and relative URLs through (trimmed)", () => {
    expect(sanitizeDocsUrl("https://github.com/Slow-Inc/MangaDock")).toBe("https://github.com/Slow-Inc/MangaDock");
    expect(sanitizeDocsUrl("  http://example.com ")).toBe("http://example.com");
    expect(sanitizeDocsUrl("mailto:dev@example.com")).toBe("mailto:dev@example.com");
    expect(sanitizeDocsUrl("/docs/overview")).toBe("/docs/overview");
  });
});
