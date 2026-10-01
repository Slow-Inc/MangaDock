"use client";

import type Lenis from "lenis";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocalLenis } from "./useLocalLenis";
import { useZoomPan } from "./useZoomPan";
import type { ChapterPages } from "../components/MangaReader";

export interface ReaderViewport {
  zoom: number;
  isDragging: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  resetZoomAndPan: () => void;
  isZoomingRef: React.RefObject<boolean>;
  continuousLenisRef: React.RefObject<Lenis | null>;
  refs: {
    zoomWrapperRef: React.RefObject<HTMLDivElement | null>;
    /** Internal numeric zoom value from useZoomPan (not a DOM ref) — re-exposed
     * under its original name per useZoomPan's actual return shape. */
    zoomRef: React.RefObject<number>;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    continuousContentRef: React.RefObject<HTMLDivElement | null>;
    pageRefs: React.RefObject<(HTMLImageElement | null)[]>;
    /** Single owner of the continuous-mode flag for gesture handlers that live
     * outside this hook (MangaReader's global keyboard/wheel listeners). */
    continuousModeRef: React.RefObject<boolean>;
  };
}

/**
 * Manga reader viewport: the six shared refs, the continuous-mode Lenis
 * instance, page-visibility syncing (IntersectionObserver + scroll-position
 * fallback), and zoom/pan (composed from useZoomPan). Extracted from
 * MangaReader (#582) — verbatim logic, same effect deps and suppressions.
 */
export function useReaderViewport({
  page,
  setPage,
  data,
  continuousMode,
}: {
  page: number;
  setPage: (p: number) => void;
  data: ChapterPages | null;
  continuousMode: boolean;
}): ReaderViewport {
  const continuousModeRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const continuousContentRef = useRef<HTMLDivElement>(null);
  const continuousLenisRef = useRef<Lenis | null>(null);
  const pageRefs = useRef<(HTMLImageElement | null)[]>([]);

  useLocalLenis(scrollContainerRef, "vertical", continuousMode, continuousLenisRef, continuousContentRef);

  const syncContinuousPageFromViewport = useCallback(() => {
    if (!continuousModeRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    let bestIdx = -1;
    let bestVisible = 0;

    pageRefs.current.forEach((img, idx) => {
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, containerRect.top);
      const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      if (visibleHeight > bestVisible) {
        bestVisible = visibleHeight;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      setPage(bestIdx);
    }
  }, [setPage]);

  const {
    zoom,
    isDragging,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomWrapperRef,
    zoomRef,
    isZoomingRef,
    resetZoomAndPan,
  } = useZoomPan({
    page,
    continuousModeRef,
    scrollContainerRef,
    continuousContentRef,
    continuousLenisRef,
    pageRefs,
    syncContinuousPageFromViewport,
  });

  // Sync continuousMode to ref so wheel handler can read it without re-binding
  useEffect(() => { continuousModeRef.current = continuousMode; }, [continuousMode]);

  // When switching TO continuous mode, the scroll container just mounted — re-sync zoom
  useEffect(() => {
    if (!continuousMode) return;
    requestAnimationFrame(() => {
      scrollContainerRef.current?.style.setProperty("--mg-zoom", String(zoomRef.current));
    });
  }, [continuousMode, zoomRef]);

  // Persistent ratio map: keeps the last known intersection ratio of every page
  // so the observer callback always has full visibility data, not just the delta.
  const pageRatioMapRef = useRef<Map<number, number>>(new Map());

  // IntersectionObserver: track visible page in continuous mode
  useEffect(() => {
    if (!continuousMode || !data) return;
    pageRatioMapRef.current.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        if (isZoomingRef.current) return; // ignore reflows caused by zoom change
        // Update the persistent map with the latest ratios from this batch
        entries.forEach((entry) => {
          const idx = Number((entry.target as HTMLElement).dataset.pageIdx);
          pageRatioMapRef.current.set(idx, entry.intersectionRatio);
        });
        // Find the globally most-visible page across ALL observed pages
        let bestIdx = -1;
        let bestRatio = 0;
        pageRatioMapRef.current.forEach((ratio, idx) => {
          if (ratio > bestRatio) { bestRatio = ratio; bestIdx = idx; }
        });
        if (bestIdx >= 0 && bestRatio > 0) setPage(bestIdx);
      },
      { root: scrollContainerRef.current, threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
    );
    pageRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => { observer.disconnect(); pageRatioMapRef.current.clear(); };
  }, [continuousMode, data, isZoomingRef, setPage]);

  // Memoized so the returned object keeps a stable identity across renders that
  // don't change zoom/drag state (e.g. the 1s translation tick). Refs are stable
  // useRef values; zoomIn/out/reset/resetZoomAndPan are useCallback-stable. This
  // lets the React.memo'd PageRenderer skip re-render when nothing it reads
  // changed (plan 2026-07-11 Perf 1).
  return useMemo(
    () => ({
      zoom,
      isDragging,
      zoomIn,
      zoomOut,
      zoomReset,
      resetZoomAndPan,
      isZoomingRef,
      continuousLenisRef,
      refs: {
        zoomWrapperRef,
        zoomRef,
        scrollContainerRef,
        continuousContentRef,
        pageRefs,
        continuousModeRef,
      },
    }),
    [
      zoom,
      isDragging,
      zoomIn,
      zoomOut,
      zoomReset,
      resetZoomAndPan,
      isZoomingRef,
      continuousLenisRef,
      zoomWrapperRef,
      zoomRef,
      scrollContainerRef,
      continuousContentRef,
      pageRefs,
      continuousModeRef,
    ],
  );
}
