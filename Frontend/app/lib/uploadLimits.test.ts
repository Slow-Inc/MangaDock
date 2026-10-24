import { describe, expect, test } from "bun:test";
import { UPLOAD_MAX_BYTES, tooLargeToUpload } from "./uploadLimits";

/** #995: the forum image and banner endpoints refuse files over 5 MB (Backend forum.controller.ts `fileSize`). */
describe("upload size limit (#995)", () => {
  test("mirrors the server's 5 MB", () => {
    expect(UPLOAD_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  test("a file at the limit is allowed, one byte more is not", () => {
    expect(tooLargeToUpload({ size: UPLOAD_MAX_BYTES })).toBe(false);
    expect(tooLargeToUpload({ size: UPLOAD_MAX_BYTES + 1 })).toBe(true);
    expect(tooLargeToUpload({ size: 0 })).toBe(false);
  });
});
