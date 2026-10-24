/**
 * Appends a comment unless it is already listed. The post's SSE stream can deliver
 * the reader's own new comment before their POST resolves; both paths add it, so
 * the second must be a no-op or the comment renders twice.
 */
export function appendComment<T extends { id: string }>(prev: T[], comment: T): T[] {
  return prev.some((c) => c.id === comment.id) ? prev : [...prev, comment];
}
