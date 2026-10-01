/**
 * Post-detail only renders the POST's own vote counts (voteCounts.get(`post:id`));
 * comment vote counts are not displayed from the SSE map. Storing comment-target
 * vote events forces a full recursive CommentThread re-render whose result is
 * discarded (plan 2026-07-11 Perf 3). Only keep events we actually render.
 */
export function isDisplayedVoteEvent(targetType: string): boolean {
  return targetType === "post";
}
