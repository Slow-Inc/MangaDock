/**
 * Resolve the avatar URL from a POST /users/me/avatar response.
 *
 * The old success path called `res.json()` unguarded: a 200 with an empty /
 * non-JSON body threw `SyntaxError`, and a 200 whose body lacked a string
 * `url` threw `TypeError` on `url.startsWith`. Both surfaced to the UI as a
 * cryptic crash even though the upload had succeeded. This helper turns every
 * anomaly into a friendly Thai Error and only returns a URL when the body is
 * valid.
 *
 * @throws Error with a user-facing Thai message on any failure.
 */
export async function resolveAvatarUrl(res: Response): Promise<string> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err?.message || `อัพโหลดไม่สำเร็จ (${res.status})`);
  }
  const data = (await res.json().catch(() => ({}))) as { url?: unknown };
  const url = data?.url;
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("อัพโหลดไม่สำเร็จ: เซิร์ฟเวอร์ไม่ส่ง URL ของรูป");
  }
  return url.startsWith("/") ? `/api/proxy${url}` : url;
}

/** Returns true if the URL is from a social OAuth CDN (Google, Facebook).
 *  Used to decide whether to skip Next.js image optimization (social CDN
 *  URLs may redirect through domains not in remotePatterns). */
export function isSocialCdnUrl(url: string): boolean {
  return (
    url.includes('lh3.googleusercontent.com') ||
    url.includes('fbcdn.net') ||
    url.includes('fbsbx.com') ||
    url.includes('graph.facebook.com')
  );
}
