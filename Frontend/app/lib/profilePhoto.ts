/**
 * The profile-picture choice (Epic D #785): the user's OAuth photo, an upload, or their mascot.
 * Pure helpers so the rules are unit-tested; the settings profile page wires them to AuthContext.
 */

/** The Image-XSS guard from CLAUDE.md, returning null (render nothing) instead of '#' for an img src. */
export function safeImageUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u || /^(javascript|data|vbscript|file):/i.test(u)) return null;
  return u;
}

const OAUTH_LABEL: Record<string, string> = { "google.com": "Google", "facebook.com": "Facebook" };

export type OAuthPhotoChoice = { providerId: string; label: string; url: string; active: boolean };

/**
 * The photos the user's linked accounts offer. Facebook's identity photo is a graph.facebook.com
 * redirect that renders as a silhouette, so it is only offered when it is a real CDN URL.
 */
export function oauthPhotoChoices(
  providerData: ReadonlyArray<{ providerId: string; photoURL?: string | null }>,
  currentPhotoURL: string | null,
): OAuthPhotoChoice[] {
  const out: OAuthPhotoChoice[] = [];
  for (const p of providerData) {
    const label = OAUTH_LABEL[p.providerId];
    const url = safeImageUrl(p.photoURL);
    if (!label || !url || url.includes("graph.facebook.com") || out.some((c) => c.url === url)) continue;
    out.push({ providerId: p.providerId, label, url, active: url === currentPhotoURL });
  }
  return out;
}

/** POST /users/me/avatar's own cap (Backend users.controller). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** A friendly Thai reason the file cannot be a profile photo, or null. The server still decides. */
export function avatarFileError(file: { type: string; size: number }): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return "รองรับเฉพาะรูป PNG, JPEG, WebP หรือ GIF";
  if (file.size === 0) return "ไฟล์ว่างเปล่า";
  if (file.size > AVATAR_MAX_BYTES) return "รูปต้องมีขนาดไม่เกิน 5 MB";
  return null;
}
