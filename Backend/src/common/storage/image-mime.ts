/**
 * Single source of truth for the accepted upload-image types.
 *
 * These are matched against a file's MAGIC BYTES (via `file-type`), never the
 * client-supplied Content-Type header, which is attacker-controlled. Keeping the
 * allow-list + extension map in one module means a security fix (e.g. dropping a
 * newly-dangerous format) cannot be missed in a second copy.
 */
export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * File extension (with leading dot) for an allowed image MIME, or `null` when
 * the MIME is not an allowed image type.
 */
export function extForMime(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}
