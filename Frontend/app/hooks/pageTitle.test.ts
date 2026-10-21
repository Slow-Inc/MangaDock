import { describe, expect, test } from "bun:test";
import { applyPageTitle } from "./pageTitle";

describe("applyPageTitle: each page names itself in the tab (#855)", () => {
  test("names the page and the site", () => {
    const doc = { title: "MangaDock by Hayate | Manga Streaming Platform" };
    applyPageTitle(doc, "มาใหม่");
    expect(doc.title).toBe("มาใหม่ · MangaDock");
  });

  test("restores the title it replaced, so the next page never inherits it", () => {
    const doc = { title: "MangaDock by Hayate | Manga Streaming Platform" };
    const restore = applyPageTitle(doc, "ค้นหา");
    restore();
    expect(doc.title).toBe("MangaDock by Hayate | Manga Streaming Platform");
  });

  test("a title that changes while mounted is restored in order", () => {
    const doc = { title: "default" };
    const first = applyPageTitle(doc, "กำลังโหลด");
    first();
    const second = applyPageTitle(doc, "One Piece");
    expect(doc.title).toBe("One Piece · MangaDock");
    second();
    expect(doc.title).toBe("default");
  });
});
