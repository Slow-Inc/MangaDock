import { describe, expect, test } from "bun:test";
import { resolveAvatarUrl, isSocialCdnUrl } from "./avatarUpload";

describe("resolveAvatarUrl", () => {
  test("prefixes /api/proxy for a relative url", async () => {
    const res = new Response(JSON.stringify({ url: "/uploads/a.png" }), { status: 200 });
    expect(await resolveAvatarUrl(res)).toBe("/api/proxy/uploads/a.png");
  });

  test("returns an absolute url unchanged", async () => {
    const res = new Response(JSON.stringify({ url: "https://cdn.example.com/a.png" }), { status: 200 });
    expect(await resolveAvatarUrl(res)).toBe("https://cdn.example.com/a.png");
  });

  test("throws a friendly message on an empty 200 body (was SyntaxError)", async () => {
    const res = new Response("", { status: 200 });
    expect(resolveAvatarUrl(res)).rejects.toThrow("เซิร์ฟเวอร์ไม่ส่ง URL");
  });

  test("throws a friendly message when the url field is missing (was TypeError)", async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    expect(resolveAvatarUrl(res)).rejects.toThrow("เซิร์ฟเวอร์ไม่ส่ง URL");
  });

  test("surfaces the backend error message on a non-ok response", async () => {
    const res = new Response(JSON.stringify({ message: "ไฟล์ใหญ่เกินไป" }), { status: 400 });
    expect(resolveAvatarUrl(res)).rejects.toThrow("ไฟล์ใหญ่เกินไป");
  });

  test("falls back to the status code when the error body is not JSON", async () => {
    const res = new Response("nope", { status: 500 });
    expect(resolveAvatarUrl(res)).rejects.toThrow("อัพโหลดไม่สำเร็จ (500)");
  });
});

describe("isSocialCdnUrl", () => {
  test("returns true for Google lh3 URL", () => {
    expect(isSocialCdnUrl("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe(true);
  });

  test("returns true for fbcdn URL with region subdomain", () => {
    expect(isSocialCdnUrl("https://scontent-bkk1-1.fbcdn.net/v/photo.jpg")).toBe(true);
  });

  test("returns true for fbsbx URL", () => {
    expect(isSocialCdnUrl("https://platform-lookaside.fbsbx.com/photo.jpg")).toBe(true);
  });

  test("returns true for graph.facebook.com URL", () => {
    expect(isSocialCdnUrl("https://graph.facebook.com/1234/picture")).toBe(true);
  });

  test("returns false for uploaded avatar relative path", () => {
    expect(isSocialCdnUrl("/uploads/avatars/uid_abc.jpg")).toBe(false);
  });

  test("returns false for proxied upload URL", () => {
    expect(isSocialCdnUrl("/api/proxy/uploads/avatars/uid_abc.jpg")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isSocialCdnUrl("")).toBe(false);
  });
});
