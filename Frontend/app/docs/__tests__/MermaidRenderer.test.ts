import { expect, test, describe } from "bun:test";
import { MERMAID_CONFIG } from "../MermaidRenderer";

describe("MermaidRenderer config", () => {
  test("uses strict security level so untrusted diagram sources cannot inject HTML/JS", () => {
    expect(MERMAID_CONFIG.securityLevel).toBe("strict");
  });

  test("does not start rendering automatically", () => {
    expect(MERMAID_CONFIG.startOnLoad).toBe(false);
  });
});
