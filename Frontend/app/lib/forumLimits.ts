/**
 * The server's forum text limits (Backend/src/forum/forum.dto.ts), mirrored so a too-long text is stopped while
 * typing instead of refused after submitting (#988).
 */
export const FORUM_LIMITS = { title: 200, content: 10_000, comment: 5_000 } as const;

/** Cut text to at most `max` characters, counted as the server counts them (code points, so an emoji is never split). */
export function clipToLimit(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max - 1).join("") + "…";
}
