/**
 * The forum image and profile banner endpoints refuse files over 5 MB (Backend forum.controller.ts `fileSize`).
 * Checked before uploading, so the user is told the limit instead of "try again" for a file that can never pass (#995).
 */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export function tooLargeToUpload(file: { size: number }): boolean {
  return file.size > UPLOAD_MAX_BYTES;
}
