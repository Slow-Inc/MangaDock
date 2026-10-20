export type ViewerState = { pageIndex: number; mode: 'strip' | 'single' | 'double'; direction: 'ltr' | 'rtl'; zoom: number };
export type PageBounds = { index: number; top: number; height: number };
export function createViewer(pageCount: number, initial?: ViewerState) {
  let state: ViewerState = initial ? { ...initial, pageIndex: Math.max(0, Math.min(pageCount - 1, initial.pageIndex)) } : { pageIndex: 0, mode: 'strip', direction: 'ltr', zoom: 1 };
  let scrollRequest: number | null = state.mode === 'strip' && state.pageIndex > 0 ? state.pageIndex : null;
  let lastTap: number | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: ViewerState) => { state = next; listeners.forEach((listener) => listener()); };
  const bounded = (index: number) => Math.max(0, Math.min(pageCount - 1, Math.floor(index) || 0));
  const goTo = (index: number) => { scrollRequest = state.mode === 'strip' ? bounded(index) : null; publish({ ...state, pageIndex: bounded(index) }); };
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    goTo,
    tap(time: number) {
      if (lastTap !== null && time >= lastTap && time - lastTap <= 280) { lastTap = null; publish({ ...state, zoom: state.zoom > 1 ? 1 : 2 }); }
      else lastTap = time;
    },
    scrollRequest: () => scrollRequest,
    cancelScrollRequest() { scrollRequest = null; },
    observeViewport(pages: PageBounds[], offset: number, viewportHeight: number) {
      if (state.mode !== 'strip') return;
      let current: PageBounds | null = null;
      let largestOverlap = 0;
      for (const page of pages) {
        const overlap = Math.max(0, Math.min(page.top + page.height, offset + viewportHeight) - Math.max(page.top, offset));
        if (overlap > largestOverlap) { largestOverlap = overlap; current = page; }
      }
      if (scrollRequest != null && current?.index !== scrollRequest) return;
      if (current) { scrollRequest = null; if (current.index !== state.pageIndex) publish({ ...state, pageIndex: bounded(current.index) }); }
    },
    next() { goTo(state.pageIndex + (state.mode === 'double' ? 2 : 1)); },
    previous() { goTo(state.pageIndex - (state.mode === 'double' ? 2 : 1)); },
    setMode(mode: ViewerState['mode']) { scrollRequest = mode === 'strip' ? state.pageIndex : null; publish({ ...state, mode }); },
    setDirection(direction: ViewerState['direction']) { publish({ ...state, direction }); },
    setZoom(zoom: number) { publish({ ...state, zoom: Math.max(1, Math.min(3, Number.isFinite(zoom) ? zoom : 1)) }); },
    patchRect(patch: { xPct: number; yPct: number; wPct: number; hPct: number }, width: number, height: number) {
      return { left: width * patch.xPct / 100, top: height * patch.yPct / 100, width: width * patch.wPct / 100, height: height * patch.hPct / 100 };
    },
    visiblePages() {
      if (pageCount < 1) return [];
      if (state.mode !== 'double') return [state.pageIndex];
      const first = Math.floor(state.pageIndex / 2) * 2;
      const pages = first + 1 < pageCount ? [first, first + 1] : [first];
      return state.direction === 'rtl' ? pages.reverse() : pages;
    },
  };
}
