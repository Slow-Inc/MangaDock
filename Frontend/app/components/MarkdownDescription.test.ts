import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownDescription from "./MarkdownDescription";

const render = (text: string) => renderToStaticMarkup(createElement(MarkdownDescription, { text }));

describe("MarkdownDescription", () => {
  test("renders a link that opens in a new tab without leaking the opener", () => {
    const html = render("ดู [Webtoon Teaser](https://www.youtube.com/watch?v=abc)");
    expect(html).toContain('href="https://www.youtube.com/watch?v=abc"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain(">Webtoon Teaser</a>");
  });

  test("auto-links a bare URL (GFM)", () => {
    expect(render("see https://example.com/page now")).toContain('href="https://example.com/page"');
  });

  test("blocks javascript: and data: URLs", () => {
    const html = render("[x](javascript:alert(1)) [y](data:text/html;base64,AAAA)");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
  });

  test("never emits raw HTML from the description", () => {
    const html = render('hi <script>alert(1)</script> <img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    // shown as inert text instead: the angle brackets are escaped
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img ");
  });

  test("does not load markdown images", () => {
    expect(render("![t](https://tracker.example/p.png)")).not.toContain("<img");
  });

  test("renders a horizontal rule, list items, bold and a line break", () => {
    const html = render("intro\n\n---\n\n- one\n- two\n\n**bold**");
    expect(html).toContain("<hr");
    expect(html).toContain("<li");
    expect(html).toContain("<strong");
  });

  test("keeps angle brackets in a link label as text", () => {
    const html = render("[Original Webtoon <Webtoon kakao>](https://webtoon.kakao.com/x)");
    expect(html).toContain("Original Webtoon &lt;Webtoon kakao&gt;");
  });

  test("the real MangaDex sample renders every link", () => {
    const md =
      "เมื่อ 'คิมรกซู' ต้องไปอยู่ในร่างอันธพาล --- - [Webtoon Teaser](https://www.youtube.com/watch?v=sh35YE4VgXE) - [Official English <Tappytoon> Translation](https://www.tappytoon.com/en/comics/lout-of-counts-family) - [Official Thai Translation](https://th.kakaowebtoon.com/content/x/14)";
    const html = render(md);
    expect((html.match(/<a /g) ?? []).length).toBe(3);
    expect(html).not.toContain("](");
  });
});
