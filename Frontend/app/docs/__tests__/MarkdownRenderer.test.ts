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
    // The code is highlighted (split into coloured spans), so compare what it reads as, not its markup.
    expect(html.replace(/<[^>]+>/g, "")).toContain("console.log(&#x27;test&#x27;);");
    expect(html).toContain("--mk-string"); // Monokai: the string is coloured
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

describe("MarkdownRenderer - lists", () => {
  test("a wrapped line stays inside its list item, and ordered numbers follow the source", () => {
    const md = "3. alpha\nbeta wrapped\n4. gamma";
    const html = renderToString(React.createElement(MarkdownRenderer, { content: md }));
    expect(html).toContain("alpha beta wrapped");
    expect(html).toContain(">03<");
    expect(html).toContain(">04<");
    expect((html.match(/<ol/g) ?? []).length).toBe(1);
  });

  test("headings get ids and tables/code stay inside scroll regions", () => {
    const md = "## Hello World\n\n| a | b |\n|---|---|\n| 1 | 2 |";
    const html = renderToString(React.createElement(MarkdownRenderer, { content: md }));
    expect(html).toContain('id="hello-world"');
    expect(html).toContain('role="region"');
  });
});
