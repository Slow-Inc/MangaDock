/**
 * Neutralise dangerous URL schemes before putting a user-supplied URL in
 * `<img src>` / `<a href>` — the repo's standard guard (CLAUDE.md "Image XSS").
 */
export function safeUrl(url: string): string {
  return /^\s*(javascript|data|vbscript|file):/i.test(url.trim()) ? "#" : url.trim();
}

/** A user-supplied image URL ready for `src`, or null when it is empty or uses a blocked scheme. */
export function safeImageSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const safe = safeUrl(url);
  return safe === "#" ? null : safe;
}
