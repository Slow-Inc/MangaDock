/**
 * The dot motif as a skeleton fill (DESIGN.md §1, "a dot field"): a 12 px grid of faint ink dots,
 * laid over a box that is already `bg-fill`. Pair it with `animate-pulse` for the quiet shimmer —
 * opacity only, so it stays cheap, and the global reduced-motion block stops it.
 */
export const DOT_FIELD =
  "bg-[radial-gradient(circle,color-mix(in_srgb,var(--ink)_24%,transparent)_1px,transparent_1.5px)] [background-size:12px_12px]";

/** Stagger for a grid of skeletons, so the shimmer travels across it instead of blinking in unison. */
export const shimmerDelay = (i: number) => ({ animationDelay: `calc(${i} * var(--stagger))` });
