/**
 * Navigation math for the forum post image viewer (#1094): one image per step, no wrap (like IG), a swipe that
 * lands on the next image past a fifth of the width or on a fast flick, and rubber-band resistance at the ends.
 */

/** The image `delta` steps away, clamped to the ends. */
export function stepIndex(index: number, delta: number, count: number): number {
  return Math.max(0, Math.min(count - 1, index + delta));
}

/** px/ms: a flick this fast moves an image even when the drag was short. */
const FLICK = 0.5;

/** Where a released swipe lands. A drag to the left (dx < 0) goes to the next image. */
export function swipeTarget({ dx, width, velocity, index, count }: {
  dx: number; width: number; velocity: number; index: number; count: number;
}): number {
  const far = Math.abs(dx) > width / 5;
  const fast = Math.abs(velocity) > FLICK && Math.sign(velocity) === Math.sign(dx);
  if (!far && !fast) return index;
  return stepIndex(index, dx < 0 ? 1 : -1, count);
}

/** How far the track follows the finger: 1:1, or a third of it when pulling past the first or last image. */
export function dragOffset(dx: number, index: number, count: number): number {
  const pastEnd = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
  return pastEnd ? dx / 3 : dx;
}
