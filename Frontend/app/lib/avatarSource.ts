import { safeUrl } from "./safeUrl";

/** The photo to show for a user, or null to show their uid mascot instead (no photo, or a blocked scheme). */
export function avatarSource(photoUrl: string | null | undefined): string | null {
  if (!photoUrl?.trim()) return null;
  const safe = safeUrl(photoUrl);
  return safe === "#" ? null : safe;
}
