/**
 * Neutralise dangerous URL schemes before putting a user-supplied URL in
 * `<img src>` / `<a href>` — the repo's standard guard (CLAUDE.md "Image XSS").
 */
export function safeUrl(url: string): string {
  return /^\s*(javascript|data|vbscript|file):/i.test(url.trim()) ? "#" : url.trim();
}
