import { describe, expect, test } from "bun:test";
import { AVATAR_MAX_BYTES, avatarFileError, oauthPhotoChoices, safeImageUrl } from "./profilePhoto";

describe("safeImageUrl: the Image-XSS guard (CLAUDE.md) for a user-supplied src", () => {
  test("keeps http(s) and site-relative URLs, trimmed", () => {
    expect(safeImageUrl(" https://lh3.googleusercontent.com/a/x ")).toBe("https://lh3.googleusercontent.com/a/x");
    expect(safeImageUrl("/api/proxy/uploads/avatars/u_1.png")).toBe("/api/proxy/uploads/avatars/u_1.png");
  });

  test("drops script-capable and local schemes, whatever the case or leading space", () => {
    for (const bad of ["javascript:alert(1)", " JavaScript:alert(1)", "data:image/svg+xml,<svg/>", "vbscript:x", "file:///etc/passwd"]) {
      expect(safeImageUrl(bad)).toBeNull();
    }
  });

  test("empty and missing are null", () => {
    expect(safeImageUrl("")).toBeNull();
    expect(safeImageUrl("   ")).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
    expect(safeImageUrl(undefined)).toBeNull();
  });
});

describe("oauthPhotoChoices: the photos the user's linked accounts offer", () => {
  const google = { providerId: "google.com", photoURL: "https://lh3.googleusercontent.com/a/g" };

  test("offers Google's photo and marks it active when it is the current one", () => {
    expect(oauthPhotoChoices([google], google.photoURL)).toEqual([
      { providerId: "google.com", label: "Google", url: google.photoURL, active: true },
    ]);
    expect(oauthPhotoChoices([google], "/api/proxy/uploads/avatars/u_1.png")[0].active).toBe(false);
  });

  test("email/password identities have no photo to offer", () => {
    expect(oauthPhotoChoices([{ providerId: "password", photoURL: "https://x/y.png" }], null)).toEqual([]);
  });

  test("skips Facebook's graph.facebook.com redirect, which renders as a silhouette", () => {
    expect(oauthPhotoChoices([{ providerId: "facebook.com", photoURL: "https://graph.facebook.com/123/picture" }], null)).toEqual([]);
    expect(oauthPhotoChoices([{ providerId: "facebook.com", photoURL: "https://scontent.fbcdn.net/v/p.jpg" }], null)).toEqual([
      { providerId: "facebook.com", label: "Facebook", url: "https://scontent.fbcdn.net/v/p.jpg", active: false },
    ]);
  });

  test("skips missing and unsafe photos, and lists one URL once", () => {
    expect(
      oauthPhotoChoices(
        [
          { providerId: "google.com", photoURL: null },
          { providerId: "google.com", photoURL: "javascript:alert(1)" },
          google,
          google,
        ],
        null,
      ),
    ).toHaveLength(1);
  });
});

describe("avatarFileError: checked before uploading (the server still decides)", () => {
  test("accepts the common image types up to the server's 5 MB cap", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      expect(avatarFileError({ type, size: 1024 })).toBeNull();
    }
    expect(avatarFileError({ type: "image/png", size: AVATAR_MAX_BYTES })).toBeNull();
  });

  test("rejects other types, empty files and files over 5 MB with a Thai message", () => {
    expect(avatarFileError({ type: "image/svg+xml", size: 10 })).toMatch(/PNG/);
    expect(avatarFileError({ type: "application/pdf", size: 10 })).toMatch(/PNG/);
    expect(avatarFileError({ type: "image/png", size: 0 })).toMatch(/ว่าง/);
    expect(avatarFileError({ type: "image/png", size: AVATAR_MAX_BYTES + 1 })).toMatch(/5 MB/);
  });
});
