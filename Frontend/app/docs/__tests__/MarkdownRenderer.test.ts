import { expect, test, describe, mock } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";

// Mock lang context to prevent crashes
mock.module("../lang-context", () => ({
  useLang: () => "en",
}));

import { MarkdownRenderer } from "../DocsClient";

describe("MarkdownRenderer - Mermaid Parsing", () => {
  test("renders normal code blocks as pre/code blocks", () => {
    const md = "```javascript\nconsole.log('test');\n```";
    const element = React.createElement(MarkdownRenderer, { content: md });
    const html = renderToString(element);
    expect(html).toContain("<pre");
    expect(html).toContain("console.log(&#x27;test&#x27;);");
  });

  test("renders mermaid code blocks using a specific class container and not standard pre/code", () => {
    const md = "```mermaid\ngraph TD\nA --> B\n```";
    const element = React.createElement(MarkdownRenderer, { content: md });
    const html = renderToString(element);
    
    // We expect it to be handled by a MermaidRenderer rather than standard pre block
    expect(html).not.toContain("<pre");
    expect(html).toContain('data-mermaid-chart="graph TD\nA --&gt; B"');
  });
});
