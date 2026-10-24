/**
 * The scrollLeft that brings a scrolling tab strip's active item into view (#830), with `pad` px to spare.
 * Setting the strip's own scrollLeft (unlike scrollIntoView) never scrolls the page.
 */
export function stripScrollLeft({ scrollLeft, itemLeft, itemWidth, stripWidth, pad }: {
  scrollLeft: number; itemLeft: number; itemWidth: number; stripWidth: number; pad: number;
}): number {
  if (itemLeft - pad < scrollLeft) return Math.max(0, itemLeft - pad);
  const rightEdge = itemLeft + itemWidth + pad - stripWidth;
  if (rightEdge > scrollLeft) return rightEdge;
  return scrollLeft;
}
