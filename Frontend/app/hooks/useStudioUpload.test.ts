import { describe, it, expect } from "bun:test";
import {
  filterImageFiles,
  validateReadyToFinish,
  appendPlaceholder,
  replacePlaceholder,
  markPlaceholderError,
  removePageByUrl,
  type PageItem,
} from "./useStudioUpload";

function makeFile(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("filterImageFiles", () => {
  it("keeps only files whose type starts with image/ from a mixed list", () => {
    const files = [
      makeFile("a.png", "image/png"),
      makeFile("b.pdf", "application/pdf"),
      makeFile("c.jpg", "image/jpeg"),
      makeFile("d.txt", "text/plain"),
    ];
    const result = filterImageFiles(files);
    expect(result.map((f) => f.name)).toEqual(["a.png", "c.jpg"]);
  });

  it("returns [] when given an empty list", () => {
    expect(filterImageFiles([])).toEqual([]);
  });

  it("returns [] when none of the files are images", () => {
    const files = [makeFile("a.pdf", "application/pdf"), makeFile("b.txt", "text/plain")];
    expect(filterImageFiles(files)).toEqual([]);
  });
});

describe("validateReadyToFinish", () => {
  const basePages: PageItem[] = [{ url: "https://x/page1.png" }];

  it("gate 1: no titleId -> warning 'กรุณาเลือกมังงะก่อน'", () => {
    const result = validateReadyToFinish({
      titleId: "",
      chapterNumber: "1",
      language: "th",
      pages: basePages,
    });
    expect(result).toEqual({ ok: false, level: "warning", message: "กรุณาเลือกมังงะก่อน" });
  });

  it("gate 2: empty chapterNumber (after trim) -> warning 'กรุณากรอกหมายเลขตอน'", () => {
    const result = validateReadyToFinish({
      titleId: "title-1",
      chapterNumber: "   ",
      language: "th",
      pages: basePages,
    });
    expect(result).toEqual({ ok: false, level: "warning", message: "กรุณากรอกหมายเลขตอน" });
  });

  it("gate 3: no language -> warning 'กรุณาเลือกภาษาที่แปล'", () => {
    const result = validateReadyToFinish({
      titleId: "title-1",
      chapterNumber: "1",
      language: "",
      pages: basePages,
    });
    expect(result).toEqual({ ok: false, level: "warning", message: "กรุณาเลือกภาษาที่แปล" });
  });

  it("gate 4: pages.length === 0 -> warning 'กรุณาอัปโหลดหน้ามังงะอย่างน้อย 1 หน้า'", () => {
    const result = validateReadyToFinish({
      titleId: "title-1",
      chapterNumber: "1",
      language: "th",
      pages: [],
    });
    expect(result).toEqual({
      ok: false,
      level: "warning",
      message: "กรุณาอัปโหลดหน้ามังงะอย่างน้อย 1 หน้า",
    });
  });

  it("gate 5: some page still uploading -> info 'กรุณารอให้การอัปโหลดเสร็จสิ้นก่อน'", () => {
    const result = validateReadyToFinish({
      titleId: "title-1",
      chapterNumber: "1",
      language: "th",
      pages: [{ url: "blob:1", uploading: true }],
    });
    expect(result).toEqual({
      ok: false,
      level: "info",
      message: "กรุณารอให้การอัปโหลดเสร็จสิ้นก่อน",
    });
  });

  it("all-clear -> { ok: true }", () => {
    const result = validateReadyToFinish({
      titleId: "title-1",
      chapterNumber: "1",
      language: "th",
      pages: basePages,
    });
    expect(result).toEqual({ ok: true });
  });

  it("gates fire in order — titleId gate wins even if chapterNumber is also empty", () => {
    const result = validateReadyToFinish({
      titleId: "",
      chapterNumber: "",
      language: "",
      pages: [],
    });
    expect(result).toEqual({ ok: false, level: "warning", message: "กรุณาเลือกมังงะก่อน" });
  });
});

describe("appendPlaceholder", () => {
  it("appends a new uploading:true placeholder page", () => {
    const pages: PageItem[] = [{ url: "https://x/existing.png" }];
    const result = appendPlaceholder(pages, "blob:new");
    expect(result).toEqual([{ url: "https://x/existing.png" }, { url: "blob:new", uploading: true }]);
    // original array untouched
    expect(pages).toEqual([{ url: "https://x/existing.png" }]);
  });
});

describe("replacePlaceholder", () => {
  it("replaces only the matching blob URL with the real server URL", () => {
    const pages: PageItem[] = [
      { url: "blob:a", uploading: true },
      { url: "blob:b", uploading: true },
    ];
    const result = replacePlaceholder(pages, "blob:a", "https://server/real-a.png");
    expect(result).toEqual([{ url: "https://server/real-a.png" }, { url: "blob:b", uploading: true }]);
  });

  it("leaves pages unchanged when the blob URL isn't found", () => {
    const pages: PageItem[] = [{ url: "blob:a", uploading: true }];
    const result = replacePlaceholder(pages, "blob:missing", "https://server/real.png");
    expect(result).toEqual(pages);
  });
});

describe("markPlaceholderError", () => {
  it("sets uploading:false and error on the matching page, keeps the blob url", () => {
    const pages: PageItem[] = [{ url: "blob:a", uploading: true }];
    const result = markPlaceholderError(pages, "blob:a", "อัปโหลดไม่สำเร็จ");
    expect(result).toEqual([{ url: "blob:a", uploading: false, error: "อัปโหลดไม่สำเร็จ" }]);
  });

  it("does not touch other pages", () => {
    const pages: PageItem[] = [
      { url: "blob:a", uploading: true },
      { url: "blob:b", uploading: true },
    ];
    const result = markPlaceholderError(pages, "blob:a", "err");
    expect(result[1]).toEqual({ url: "blob:b", uploading: true });
  });
});

describe("removePageByUrl", () => {
  it("filters out the page matching the given url", () => {
    const pages: PageItem[] = [{ url: "a" }, { url: "b" }, { url: "c" }];
    const result = removePageByUrl(pages, "b");
    expect(result).toEqual([{ url: "a" }, { url: "c" }]);
  });

  it("returns an equivalent list when the url isn't present", () => {
    const pages: PageItem[] = [{ url: "a" }];
    expect(removePageByUrl(pages, "z")).toEqual([{ url: "a" }]);
  });
});
