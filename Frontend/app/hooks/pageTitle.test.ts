import { describe, expect, test } from "bun:test";
import { titleStack } from "./pageTitle";

describe("titleStack: each page names itself in the tab (#855)", () => {
  test("names the page and the site", () => {
    const doc = { title: "MangaDock by Hayate | Manga Streaming Platform" };
    titleStack(doc).push("มาใหม่");
    expect(doc.title).toBe("มาใหม่ · MangaDock");
  });

  test("removing the last title brings back the root title, so the next page never inherits it", () => {
    const doc = { title: "MangaDock by Hayate | Manga Streaming Platform" };
    const remove = titleStack(doc).push("ค้นหา");
    remove();
    expect(doc.title).toBe("MangaDock by Hayate | Manga Streaming Platform");
  });

  test("a title that changes while mounted ends on the new one, then the root", () => {
    const doc = { title: "root" };
    const stack = titleStack(doc);
    stack.push("กำลังโหลด")();
    const remove = stack.push("One Piece");
    expect(doc.title).toBe("One Piece · MangaDock");
    remove();
    expect(doc.title).toBe("root");
  });
});

describe("titleStack: titles from nested owners, removed in any order (#855)", () => {
  test("a page and the popup over it, unmounted parent-first, leave the root title", () => {
    const doc = { title: "root" };
    const stack = titleStack(doc);
    const removePage = stack.push("หนังสือทั้งหมด");
    const removePopup = stack.push("One Piece");
    expect(doc.title).toBe("One Piece · MangaDock");
    removePage(); // React unmounts the parent's effects first
    expect(doc.title).toBe("One Piece · MangaDock");
    removePopup();
    expect(doc.title).toBe("root");
  });

  test("closing the popup brings back the page's title", () => {
    const doc = { title: "root" };
    const stack = titleStack(doc);
    stack.push("หนังสือทั้งหมด");
    const removePopup = stack.push("One Piece");
    removePopup();
    expect(doc.title).toBe("หนังสือทั้งหมด · MangaDock");
  });
});

describe("titleStack.current: the title the tab should show while something claims it (#855)", () => {
  test("is the top claim, and nothing once every claim is gone", () => {
    const doc = { title: "root" };
    const stack = titleStack(doc);
    expect(stack.current()).toBeNull();
    const remove = stack.push("ค้นหา");
    expect(stack.current()).toBe("ค้นหา · MangaDock");
    remove();
    expect(stack.current()).toBeNull();
  });
});
