"use client";

import type Lenis from "lenis";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { zoomInLevel, zoomOutLevel } from "../lib/zoomLevel";

/**
 * Continuous-mode zoom-anchor math (extracted so it's unit-testable without a
 * DOM): given the on-screen rects of every page block, pick the block that
 * anchors the viewport top and how far into that block the viewport top sits,
 * so a zoom change can restore the same visual anchor point after the layout
 * reflow zoom causes.
 */
export interface ZoomAnchor {
  pageIndex: number;
  viewportAnchorPx: number;
  anchorRatio: number;
}

export interface ZoomAnchorBlock {
  index: number;
  top: number;
  bottom: number;
  height: number;
}

/**
 * Two-pass block selection: pass 1 picks the block straddling viewportTop
 * (top <= viewportTop && bottom > viewportTop); pass 2 falls back to the
 * first block whose bottom is below containerTop (used when nothing
 * straddles, e.g. viewport sits exactly on a block boundary). Returns null
 * when no block qualifies (e.g. an empty list, or every block is above the
 * viewport).
 */
export function computeZoomAnchor(input: {
  viewportTop: number;
  containerTop: number;
  blocks: ZoomAnchorBlock[];
}): ZoomAnchor | null {
  const { viewportTop, containerTop, blocks } = input;

  let anchorBlock: ZoomAnchorBlock | null = null;
  for (const block of blocks) {
    if (block.top <= viewportTop && block.bottom > viewportTop) {
      anchorBlock = block;
      break;
    }
  }
  if (!anchorBlock) {
    for (const block of blocks) {
      if (block.bottom > containerTop) {
        anchorBlock = block;
        break;
      }
    }
  }
  if (!anchorBlock) return null;

  const blockTopInViewport = anchorBlock.top - containerTop;
  const blockBottomInViewport = anchorBlock.bottom - containerTop;
  const viewportAnchorPx =
    blockTopInViewport <= 0 ? 0 : Math.min(Math.max(0, blockTopInViewport), blockBottomInViewport);
  const anchorRatio =
    anchorBlock.height > 0 ? (viewportAnchorPx - blockTopInViewport) / anchorBlock.height : 0.5;

  return {
    pageIndex: anchorBlock.index,
    viewportAnchorPx,
    anchorRatio: Math.max(0, Math.min(1, anchorRatio)),
  };
}

/** Scroll offset that restores `anchor` to the same viewport position after a layout shift. */
export function computeRestoredScroll(input: {
  currentScroll: number;
  containerTop: number;
  blockTop: number;
  blockHeight: number;
  anchor: { anchorRatio: number; viewportAnchorPx: number };
}): number {
  const { currentScroll, containerTop, blockTop, blockHeight, anchor } = input;
  const blockTopAbsolute = currentScroll + (blockTop - containerTop);
  return Math.max(0, blockTopAbsolute + anchor.anchorRatio * blockHeight - anchor.viewportAnchorPx);
}

export interface UseZoomPanArgs {
  page: number;
  /** Owned by MangaReader — synced from the `continuousMode` state so gesture handlers can read it without re-binding. */
  continuousModeRef: RefObject<boolean>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  continuousContentRef: RefObject<HTMLDivElement | null>;
  continuousLenisRef: RefObject<Lenis | null>;
  pageRefs: RefObject<(HTMLImageElement | null)[]>;
  syncContinuousPageFromViewport: () => void;
}

export function useZoomPan({
  page,
  continuousModeRef,
  scrollContainerRef,
  continuousContentRef,
  continuousLenisRef,
  pageRefs,
  syncContinuousPageFromViewport,
}: UseZoomPanArgs) {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const zoomRef = useRef(1);
  const isZoomingRef = useRef(false);
  const zoomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomWrapperRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });

  const applyTransform = (z: number, px: number, py: number, animate = true) => {
    const el = zoomWrapperRef.current;
    if (!el) return;
    el.style.setProperty("--mg-zoom", String(z));
    el.style.setProperty("--mg-pan-x", `${px}px`);
    el.style.setProperty("--mg-pan-y", `${py}px`);
    el.style.setProperty("--mg-transition", animate ? "transform 0.15s ease" : "none");
  };

  const resetPan = () => {
    panRef.current = { x: 0, y: 0 };
    setPanX(0);
    setPanY(0);
  };

  const markZooming = () => {
    isZoomingRef.current = true;
    if (zoomingTimerRef.current) clearTimeout(zoomingTimerRef.current);
    zoomingTimerRef.current = setTimeout(() => { isZoomingRef.current = false; }, 300);
  };

  const getContinuousZoomAnchor = useCallback((): ZoomAnchor | null => {
    if (!continuousModeRef.current) return null;
    const container = scrollContainerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const viewportTop = containerRect.top + 1;

    const blocks: ZoomAnchorBlock[] = [];
    pageRefs.current.forEach((img, idx) => {
      if (!img) return;
      const block = img.parentElement as HTMLElement | null;
      if (!block) return;
      const rect = block.getBoundingClientRect();
      blocks.push({ index: idx, top: rect.top, bottom: rect.bottom, height: rect.height });
    });

    return computeZoomAnchor({ viewportTop, containerTop: containerRect.top, blocks });
  }, [continuousModeRef, scrollContainerRef, pageRefs]);

  const restoreContinuousZoomAnchor = useCallback((anchor: ZoomAnchor | null) => {
    if (!anchor || !continuousModeRef.current) return;
    const container = scrollContainerRef.current;
    const lenis = continuousLenisRef.current;
    const targetImg = pageRefs.current[anchor.pageIndex];
    const targetBlock = targetImg?.parentElement as HTMLElement | null;
    if (!container || !targetBlock) return;

    const currentScroll = lenis?.actualScroll ?? container.scrollTop ?? 0;
    const containerRect = container.getBoundingClientRect();
    const blockRect = targetBlock.getBoundingClientRect();
    const targetScroll = computeRestoredScroll({
      currentScroll,
      containerTop: containerRect.top,
      blockTop: blockRect.top,
      blockHeight: blockRect.height,
      anchor,
    });

    if (lenis) {
      lenis.scrollTo(targetScroll, { immediate: true, force: true });
    } else {
      container.scrollTop = targetScroll;
    }
  }, [continuousModeRef, scrollContainerRef, continuousLenisRef, pageRefs]);

  const updateZoom = useCallback((computeNext: (current: number) => number) => {
    markZooming();
    const currentZoom = zoomRef.current;
    const nextZoom = computeNext(currentZoom);
    if (nextZoom === currentZoom) return;

    zoomRef.current = nextZoom;

    if (!continuousModeRef.current) {
      setZoom(nextZoom);
      if (nextZoom <= 1) resetPan();
      return;
    }

    const zoomAnchor = getContinuousZoomAnchor();

    setZoom(nextZoom);
    if (nextZoom <= 1) resetPan();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const nextContainer = scrollContainerRef.current;
        const nextContent = continuousContentRef.current;
        const nextLenis = continuousLenisRef.current;
        if (!nextContainer || !nextContent) {
          syncContinuousPageFromViewport();
          return;
        }

        nextLenis?.resize();
        restoreContinuousZoomAnchor(zoomAnchor);

        requestAnimationFrame(() => {
          syncContinuousPageFromViewport();
        });
      });
    });
  }, [
    continuousModeRef,
    scrollContainerRef,
    continuousContentRef,
    continuousLenisRef,
    getContinuousZoomAnchor,
    restoreContinuousZoomAnchor,
    syncContinuousPageFromViewport,
  ]);

  const zoomIn = () => updateZoom(zoomInLevel);
  const zoomOut = () => updateZoom(zoomOutLevel);
  const zoomReset = () => updateZoom(() => 1);

  const resetZoomAndPan = useCallback(() => {
    setZoom(1);
    resetPan();
  }, []);

  useEffect(() => {
    applyTransform(zoom, panX, panY);
    // Also sync zoom to continuous mode scroll container
    scrollContainerRef.current?.style.setProperty("--mg-zoom", String(zoom));
  }, [zoom, panX, panY, scrollContainerRef]);

  // Pan must reset on every page change; the page is set from many sites
  // (buttons, keyboard, IntersectionObserver), so this effect is the choke point.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { resetPan(); }, [page]);

  // Mouse drag-to-pan (paged mode only)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || continuousModeRef.current || zoomRef.current <= 1) return;
      e.preventDefault();
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setIsDragging(true);
      applyTransform(zoomRef.current, panRef.current.x, panRef.current.y, false);
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      const el = zoomWrapperRef.current;
      if (el) {
        el.style.setProperty("--mg-pan-x", `${panRef.current.x}px`);
        el.style.setProperty("--mg-pan-y", `${panRef.current.y}px`);
      }
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);
      setPanX(panRef.current.x);
      setPanY(panRef.current.y);
      applyTransform(zoomRef.current, panRef.current.x, panRef.current.y, true);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [continuousModeRef]);

  return {
    zoom,
    panX,
    panY,
    isDragging,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomWrapperRef,
    zoomRef,
    isZoomingRef,
    resetZoomAndPan,
  };
}
