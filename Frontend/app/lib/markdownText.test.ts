import { describe, expect, test } from "bun:test";
import { stripMarkdown } from "./markdownText";

describe("stripMarkdown", () => {
  test("link -> its label only", () => {
    expect(stripMarkdown("ดู [Webtoon Teaser](https://www.youtube.com/watch?v=abc) ได้เลย")).toBe(
      "ดู Webtoon Teaser ได้เลย",
    );
  });

  test("keeps angle brackets inside a link label", () => {
    expect(stripMarkdown("[Original Webtoon <Webtoon kakao>](https://webtoon.kakao.com/x)")).toBe(
      "Original Webtoon <Webtoon kakao>",
    );
  });

  test("drops horizontal rules and list bullets", () => {
    expect(stripMarkdown("intro\n\n---\n\n- first\n- second")).toBe("intro first second");
  });

  test("the real MangaDex shape: synopsis, '---', then a link list (one per line)", () => {
    const md =
      "เรื่องย่อ\n\n---\n\n- [Webtoon Teaser](https://youtu.be/x)\n- [Official Thai Translation](https://th.kakaowebtoon.com/c/14)";
    expect(stripMarkdown(md)).toBe("เรื่องย่อ Webtoon Teaser Official Thai Translation");
  });

  test("does not touch a spaced dash inside normal prose", () => {
    expect(stripMarkdown("good - but not great")).toBe("good - but not great");
  });

  test("strips bold / italic / strikethrough / inline code / headings", () => {
    expect(stripMarkdown("# Title\n**bold** *it* __b2__ _i2_ ~~gone~~ `code`")).toBe(
      "Title bold it b2 i2 gone code",
    );
  });

  test("drops images entirely", () => {
    expect(stripMarkdown("before ![alt text](https://x/y.png) after")).toBe("before after");
  });

  test("keeps underscores inside words (snake_case, urls) intact", () => {
    expect(stripMarkdown("see snake_case_name here")).toBe("see snake_case_name here");
  });

  test("collapses whitespace and handles empty input", () => {
    expect(stripMarkdown("a\n\n\n  b\t c")).toBe("a b c");
    expect(stripMarkdown("")).toBe("");
  });

  test("tolerates a missing description", () => {
    expect(stripMarkdown(undefined)).toBe("");
    expect(stripMarkdown(null)).toBe("");
  });
});
