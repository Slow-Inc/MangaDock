/**
 * The banner's vertical position (0–100, `object-position` y) after a key press on the reposition slider (#1083).
 * Up/Right raise it as dragging up does; null = not a slider key.
 */
export function bannerPositionForKey(key: string, pos: number): number | null {
  const steps: Record<string, number> = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 20, PageDown: -20 };
  if (key === "Home") return 0;
  if (key === "End") return 100;
  if (!(key in steps)) return null;
  return Math.max(0, Math.min(100, Math.round(pos + steps[key])));
}
