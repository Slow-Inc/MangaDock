import { describe, expect, test } from "bun:test";
import { resolveAvatarUrl } from "./avatarUpload";

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
