export function computeScrollState(m: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): { canScrollLeft: boolean; canScrollRight: boolean } {
  return {
    canScrollLeft: m.scrollLeft > 0,
    canScrollRight: m.scrollLeft + m.clientWidth < m.scrollWidth - 1,
  };
}
