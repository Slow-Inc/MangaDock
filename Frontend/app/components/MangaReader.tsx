"use client";

import type Lenis from "lenis";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addToHistory, getHistory } from "../lib/readingHistory";
import { translateMangaChapterBatchPatches, translateMangaPagePatches, checkMitHealth, type PatchData } from "../lib/mangaTranslatePage";
import { useLocalLenis } from "../hooks/useLocalLenis";

type ChapterPages = {
  pages: string[];
  dataSaverPages: string[];
  /** Local /img-cache/… paths served by the backend (IMAGE_CACHE_ENABLED=true). */
  localPages?: string[];
  localDataSaverPages?: string[];
  /** Set to false in forceLocal responses when no pages are cached yet. */
  localCacheAvailable?: boolean;
};

type ChapterPageItem = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
  translatedLanguage: string;
};

type Props = {
  chapterId: string;
  chapterNumber: string | null;
  chapterTitle: string | null;
  mangaTitle: string;
  mangaId?: string;
  onClose: () => void;
};

const API_BASE = "/api/proxy";
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const TARGET_LANG_OPTIONS: { code: string; label: string }[] = [
  { code: "th", label: "→ TH" },
  { code: "en", label: "→ EN" },
  { code: "zh", label: "→ ZH" },
];

export default function MangaReader({ chapterId: initialChapterId, chapterNumber: initialChapterNumber, chapterTitle: initialChapterTitle, mangaTitle, mangaId, onClose }: Props) {
  // Current chapter state — can change via navigation
  const [currentChapterId, setCurrentChapterId] = useState(initialChapterId);
  const [currentChapterNumber, setCurrentChapterNumber] = useState(initialChapterNumber);
  const [currentChapterTitle, setCurrentChapterTitle] = useState(initialChapterTitle);

  // Chapter list for navigation
  const [chapterList, setChapterList] = useState<ChapterPageItem[]>([]);
  const currentIdx = chapterList.findIndex((c) => c.id === currentChapterId);
  const currentLang = chapterList[currentIdx]?.translatedLanguage ?? null;

  // Filtered list of chapters in the same language (for prev/next navigation)
  const sameLangList = currentLang ? chapterList.filter((c) => c.translatedLanguage === currentLang) : [];
  const sameLangIdx = sameLangList.findIndex((c) => c.id === currentChapterId);

  // Prev/next chapter in the SAME language
  const prevSameLang = sameLangIdx > 0 ? sameLangList[sameLangIdx - 1] : null;
  const nextSameLang = sameLangIdx !== -1 && sameLangIdx < sameLangList.length - 1
    ? sameLangList[sameLangIdx + 1]
    : null;

  // Other languages that have chapters remaining after the current position
  // Only include chapters with a strictly higher chapter number (avoid showing
  // the same chapter number translated into another language as "next").
  const currentChapterNum = chapterList[currentIdx]?.chapterNumber ?? null;
  const otherLangNextMap = (() => {
    if (currentIdx < 0) return new Map<string, ChapterPageItem>();
    const map = new Map<string, ChapterPageItem>();
    for (const ch of chapterList.slice(currentIdx + 1)) {
      // Skip if same or lower chapter number
      if (currentChapterNum !== null && ch.chapterNumber !== null) {
        if (parseFloat(ch.chapterNumber) <= parseFloat(currentChapterNum)) continue;
      }
      if (!map.has(ch.translatedLanguage)) map.set(ch.translatedLanguage, ch);
    }
    if (currentLang) map.delete(currentLang);
    return map;
  })();

  const hasPrev = prevSameLang !== null;
  const hasNext = nextSameLang !== null;

  // Chapter counter: show actual chapter number as "X / MAX" where MAX is the
  // highest integer chapter number in the same-language list.
  // e.g. chapters [2, 13, 13.5, 14] → max = 14, so ch 13.5 shows "13.5 / 14"
  // and a language with only [2, 14] shows "2 / 14" and "14 / 14".
  const maxMainChapter = sameLangList.reduce<number | null>((acc, c) => {
    if (c.chapterNumber === null) return acc;
    const n = Math.floor(parseFloat(c.chapterNumber));
    if (isNaN(n)) return acc;
    return acc === null || n > acc ? n : acc;
  }, null);
  const chapterNumDisplay = currentChapterNum !== null ? currentChapterNum.replace(/\.0$/, "") : null;

  // Whether to show end-of-chapter banner (last page) and what kind
  const hasNextSameLang = nextSameLang !== null;
  const hasNextOtherLang = otherLangNextMap.size > 0;

  const LANG_LABEL: Record<string, string> = { th: "ภาษาไทย", en: "English", ja: "日本語" };
  const langLabel = (l: string) => LANG_LABEL[l] ?? l.toUpperCase();

  // Use currentChapterId as the operative chapter id
  const chapterId = currentChapterId;
  const chapterNumber = currentChapterNumber;
  const chapterTitle = currentChapterTitle;
  const [data, setData] = useState<ChapterPages | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [noCacheError, setNoCacheError] = useState(false);
  const [page, setPage] = useState(0);
  const [contentReady, setContentReady] = useState(false);
  const contentReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [useSaver, setUseSaver] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatingCurrentPage, setTranslatingCurrentPage] = useState(false);
  const [transProgress, setTransProgress] = useState({ done: 0, total: 0 });
  const [translatedPages, setTranslatedPages] = useState<Map<number, string>>(new Map());
  const [patchedPages, setPatchedPages] = useState<Map<number, PatchData[]>>(new Map());
  const [completedTranslatedPages, setCompletedTranslatedPages] = useState<Set<number>>(new Set());
  const [showTranslation, setShowTranslation] = useState(true);
  const [targetLang, setTargetLang] = useState<string>("th");
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);
  const translateMenuRef = useRef<HTMLDivElement | null>(null);
  const translateControllerRef = useRef<AbortController | null>(null);
  const [mitStatus, setMitStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [imgLoading, setImgLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);

  // Track last valid page count so the counter can show it during fade-out
  const lastValidTotalPagesRef = useRef(0);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const showChapterPickerRef = useRef(false);
  const [pickerLangFilter, setPickerLangFilter] = useState<string>("all");
  const pickerRef = useRef<HTMLDivElement>(null);
  const activeChapterBtnRef = useRef<HTMLButtonElement>(null);
  const pickerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPicker = (lang: string) => {
    if (pickerCloseTimerRef.current) clearTimeout(pickerCloseTimerRef.current);
    setPickerLangFilter(lang);
    setPickerMounted(true);
    // Defer visible so mount happens first, then CSS transition kicks in
    requestAnimationFrame(() => requestAnimationFrame(() => setPickerVisible(true)));
  };

  const closePicker = () => {
    setPickerVisible(false);
    pickerCloseTimerRef.current = setTimeout(() => setPickerMounted(false), 300);
  };

  // Sync picker open state to ref for ESC handler
  useEffect(() => { showChapterPickerRef.current = pickerMounted; }, [pickerMounted]);

  // Scroll picker to active chapter when it opens / lang filter changes
  useEffect(() => {
    if (!pickerVisible) return;
    requestAnimationFrame(() => {
      activeChapterBtnRef.current?.scrollIntoView({ block: "center" });
    });
  }, [pickerVisible, pickerLangFilter]);

  // Check MIT service health on mount
  useEffect(() => {
    checkMitHealth().then((ok) => setMitStatus(ok ? "online" : "offline"));
  }, []);

  // Reset translation state whenever the chapter changes
  useEffect(() => {
    translateControllerRef.current?.abort();
    translateControllerRef.current = null;
    setTranslating(false);
    setTransProgress({ done: 0, total: 0 });
    setTranslatedPages(new Map());
    setPatchedPages(new Map());
    setCompletedTranslatedPages(new Set());
    setShowTranslation(true);
  }, [currentChapterId]);

  // Reset translated state when target language changes (different cache key)
  useEffect(() => {
    translateControllerRef.current?.abort();
    translateControllerRef.current = null;
    setTranslating(false);
    setTransProgress({ done: 0, total: 0 });
    setPatchedPages(new Map());
    setCompletedTranslatedPages(new Set());
  }, [targetLang]);

  // Never keep target language equal to current chapter/source language.
  useEffect(() => {
    const source = (currentLang ?? "").toLowerCase();
    if (!source) return;
    if (targetLang.toLowerCase() !== source) return;
    const next = TARGET_LANG_OPTIONS.find((l) => l.code !== source)?.code;
    if (next) setTargetLang(next);
  }, [currentLang, targetLang]);

  // Close translate dropdown on outside click
  useEffect(() => {
    if (!translateMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (translateMenuRef.current && !translateMenuRef.current.contains(e.target as Node)) {
        setTranslateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [translateMenuOpen]);

  const zoomRef = useRef(1);
  const continuousModeRef = useRef(false);
  const isZoomingRef = useRef(false);
  const zoomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomWrapperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const continuousLenisRef = useRef<Lenis | null>(null);
  const pageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });

  useLocalLenis(scrollContainerRef, "vertical", continuousMode, continuousLenisRef);

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

  const zoomIn  = () => { markZooming(); setZoom((z) => { const nz = Math.min(+(z + ZOOM_STEP).toFixed(2), ZOOM_MAX); zoomRef.current = nz; return nz; }); };
  const zoomOut = () => { markZooming(); setZoom((z) => {
    const nz = Math.max(+(z - ZOOM_STEP).toFixed(2), ZOOM_MIN);
    zoomRef.current = nz;
    if (nz <= 1) resetPan();
    return nz;
  }); };
  const zoomReset = () => { markZooming(); zoomRef.current = 1; setZoom(1); resetPan(); };

  useEffect(() => {
    applyTransform(zoom, panX, panY);
    // Also sync zoom to continuous mode scroll container
    scrollContainerRef.current?.style.setProperty("--mg-zoom", String(zoom));
  }, [zoom, panX, panY]);

  useEffect(() => {
    if (!mangaId) return;
    fetch(`${API_BASE}/books/manga/${mangaId}/chapters`)
      .then((r) => r.json())
      .then((d: ChapterPageItem[]) => { if (Array.isArray(d)) setChapterList(d); })
      .catch(() => {});
  }, [mangaId]);

  const goToChapter = (ch: ChapterPageItem) => {
    setCurrentChapterId(ch.id);
    setCurrentChapterNumber(ch.chapterNumber);
    setCurrentChapterTitle(ch.title);
  };

  useEffect(() => {
    setMounted(true);
    setPage(0);
    setData(null);
    setError(false);
    setNoCacheError(false);
    setLoading(true);
    setContentReady(false);
    if (contentReadyTimerRef.current) clearTimeout(contentReadyTimerRef.current);
    setZoom(1);
    resetPan();
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";

    fetch(`${API_BASE}/books/chapters/${chapterId}/pages${localStorage.getItem("imgCacheForceLocal") === "1" ? "?forceLocal=true" : ""}`)
      .then((r) => { if (!r.ok) throw new Error("not ok"); return r.json(); })
      .then((d: ChapterPages) => {
        // forceLocal mode: backend signals no pages are cached yet
        if (d.localCacheAvailable === false) {
          setNoCacheError(true);
          setLoading(false);
          contentReadyTimerRef.current = setTimeout(() => setContentReady(true), 300);
          return;
        }
        if (!d || (d.pages.length === 0 && d.dataSaverPages.length === 0)) setError(true);
        else setData(d);
        setLoading(false);
        contentReadyTimerRef.current = setTimeout(() => setContentReady(true), 300);
        // Update reading history chapter progress
        if (mangaId) {
          const existing = getHistory().find((h) => h.id === mangaId);
          if (existing) {
            addToHistory({ ...existing, lastChapterId: chapterId, lastChapterNumber: chapterNumber ?? null });
          }
        }
      })
      .catch(() => { setError(true); setLoading(false); contentReadyTimerRef.current = setTimeout(() => setContentReady(true), 300); });

    return () => { document.body.style.overflow = ""; };
  }, [chapterId]);

  useEffect(() => { resetPan(); }, [page]);

  // Sync continuousMode to ref so wheel handler can read it without re-binding
  useEffect(() => { continuousModeRef.current = continuousMode; }, [continuousMode]);

  // When switching TO continuous mode, the scroll container just mounted — re-sync zoom
  useEffect(() => {
    if (!continuousMode) return;
    requestAnimationFrame(() => {
      scrollContainerRef.current?.style.setProperty("--mg-zoom", String(zoomRef.current));
    });
  }, [continuousMode]);

  // IntersectionObserver: track visible page in continuous mode
  useEffect(() => {
    if (!continuousMode || !data) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isZoomingRef.current) return; // ignore reflows caused by zoom change
        let best: { idx: number; ratio: number } | null = null;
        entries.forEach((entry) => {
          const idx = Number((entry.target as HTMLElement).dataset.pageIdx);
          if (!best || entry.intersectionRatio > best.ratio)
            best = { idx, ratio: entry.intersectionRatio };
        });
        if (best && (best as { idx: number; ratio: number }).ratio > 0)
          setPage((best as { idx: number }).idx);
      },
      { root: scrollContainerRef.current, threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    );
    pageRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [continuousMode, data]);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 250); };

  // Prefer locally-cached paths when available (backend IMAGE_CACHE_ENABLED=true).
  // Non-cached pages are routed through the img-proxy so the browser never hits
  // MangaDex CDN directly — a direct request sends the VPS URL as Referer which
  // MangaDex blocks with their "You can read this at mangadex.org" banner image.
  const resolvePages = (originals: string[], locals?: string[]) => {
    return originals.map((orig, i) => {
      const local = locals?.[i];
      if (local && local.startsWith("/img-cache")) return `${API_BASE}${local}`;
      return `/api/img-proxy?url=${encodeURIComponent(orig)}`;
    });
  };

  const pages = useSaver
    ? resolvePages(data?.dataSaverPages ?? [], data?.localDataSaverPages)
    : resolvePages(data?.pages ?? [], data?.localPages);
  const totalPages = pages.length;

  // Keep last valid page count so counter can show it during chapter-change fade-out
  useEffect(() => {
    if (contentReady && totalPages > 0) lastValidTotalPagesRef.current = totalPages;
  }, [contentReady, totalPages]);

  // Keyboard shortcuts + smooth continuous scroll via Lenis
  useEffect(() => {
    const SCROLL_SPEED = 8; // px per frame (~480px/s at 60fps)
    let direction = 0; // -1 up, +1 down, 0 stopped
    let rafId = 0;
    let keyboardTargetScroll: number | null = null;

    const loop = () => {
      if (direction !== 0) {
        const lenis = continuousLenisRef.current;
        const container = scrollContainerRef.current;

        if (lenis) {
          const baseScroll = keyboardTargetScroll ?? lenis.actualScroll;
          keyboardTargetScroll = Math.max(0, baseScroll + direction * SCROLL_SPEED);
          lenis.scrollTo(keyboardTargetScroll, {
            force: true,
          });
        } else if (container) {
          container.scrollTop += direction * SCROLL_SPEED;
        }
      } else {
        keyboardTargetScroll = null;
      }
      rafId = requestAnimationFrame(loop);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (showChapterPickerRef.current) { closePicker(); return; } handleClose(); return; }
      if (continuousModeRef.current) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (direction === 0) {
            keyboardTargetScroll = continuousLenisRef.current?.actualScroll
              ?? scrollContainerRef.current?.scrollTop
              ?? 0;
          }
          direction = e.key === "ArrowDown" ? 1 : -1;
        }
      } else {
        if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, totalPages - 1));
        if (e.key === "ArrowLeft")  setPage((p) => Math.max(p - 1, 0));
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomIn(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") { e.preventDefault(); zoomOut(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); zoomReset(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        direction = 0;
        keyboardTargetScroll = null;
      }
    };

    rafId = requestAnimationFrame(loop);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [totalPages]);

  // Wheel: zoom in paged mode, native scroll in continuous mode
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (continuousModeRef.current) return; // let browser scroll naturally
      // Let the chapter picker scroll normally — don't intercept
      if (pickerRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

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
  }, []);

  // Scroll to page when clicking page strip in continuous mode
  const scrollToPage = (idx: number) => {
    const el = pageRefs.current[idx];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startTranslate = async () => {
    if (!data || data.pages.length === 0) return;
    // Re-verify service before starting
    const healthy = await checkMitHealth();
    setMitStatus(healthy ? "online" : "offline");
    if (!healthy) return;

    const total = data.pages.length;
    const pendingIndices = Array.from({ length: total }, (_, i) => i).filter(
      (idx) => !completedTranslatedPages.has(idx),
    );
    if (pendingIndices.length === 0) return;

    const controller = new AbortController();
    translateControllerRef.current = controller;
    setTranslating(true);
    setTransProgress({ done: completedTranslatedPages.size, total });

    // Build page list in priority order — visible page first for instant feedback
    const pendingSet = new Set(pendingIndices);
    const otherIndices = pendingIndices.filter((i) => i !== page);
    const orderedIndices = pendingSet.has(page) ? [page, ...otherIndices] : otherIndices;
    const batchPages = orderedIndices.map((idx) => ({
      pageIndex: idx,
      pageUrl: data.pages[idx],
    }));

    const doneSet = new Set<number>(completedTranslatedPages);
    try {
      await translateMangaChapterBatchPatches(
        chapterId,
        batchPages,
        (pageIndex, patches) => {
          if (controller.signal.aborted) return;
          if (patches.length > 0) {
            setPatchedPages((prev) => new Map(prev).set(pageIndex, patches));
          }
          doneSet.add(pageIndex);
          setCompletedTranslatedPages(new Set(doneSet));
          setTransProgress({ done: doneSet.size, total });
        },
        controller.signal,
        { sourceLang: currentLang ?? undefined, targetLang },
      );
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.error("[BatchTranslate] Failed:", err);

        const msg = err instanceof Error ? err.message : String(err);
        const shouldRetryBatch =
          /Batch translate failed \(500\)/i.test(msg) ||
          /network error|failed to fetch|fetch failed/i.test(msg);

        if (shouldRetryBatch) {
          const maxBatchRetries = 2;
          for (let attempt = 1; attempt <= maxBatchRetries; attempt++) {
            if (controller.signal.aborted) break;

            const remainingIndices = orderedIndices.filter((idx) => !doneSet.has(idx));
            if (remainingIndices.length === 0) break;

            const retryBatchPages = remainingIndices.map((idx) => ({
              pageIndex: idx,
              pageUrl: data.pages[idx],
            }));

            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));

            try {
              await translateMangaChapterBatchPatches(
                chapterId,
                retryBatchPages,
                (pageIndex, patches) => {
                  if (controller.signal.aborted) return;
                  if (patches.length > 0) {
                    setPatchedPages((prev) => new Map(prev).set(pageIndex, patches));
                  }
                  doneSet.add(pageIndex);
                  setCompletedTranslatedPages(new Set(doneSet));
                  setTransProgress({ done: doneSet.size, total });
                },
                controller.signal,
                { sourceLang: currentLang ?? undefined, targetLang },
              );
            } catch (retryErr) {
              if (retryErr instanceof Error && retryErr.name === "AbortError") break;
              console.warn(`[BatchTranslate] Retry ${attempt}/${maxBatchRetries} failed:`, retryErr);
            }
          }
        }
      }
    } finally {
      if (translateControllerRef.current === controller) {
        translateControllerRef.current = null;
      }
      if (!controller.signal.aborted) setTranslating(false);
    }
  };

  const cancelTranslate = () => {
    translateControllerRef.current?.abort();
    translateControllerRef.current = null;
    setTranslating(false);
  };

  /** Translate only the current page — for debugging specific pages */
  const translateCurrentPage = async () => {
    if (!data || translatingCurrentPage || translating) return;
    const pageUrl = data.pages[page];
    if (!pageUrl) return;
    setTranslatingCurrentPage(true);
    console.log(`[PageTranslate] Translating page ${page + 1} (index ${page}):`, pageUrl);
    try {
      const patches = await translateMangaPagePatches(chapterId, page, pageUrl, undefined, {
        sourceLang: currentLang ?? undefined,
        targetLang,
      });
      console.log(`[PageTranslate] Page ${page + 1} done — ${patches.length} patches:`, patches);
      if (patches.length > 0) {
        setPatchedPages((prev) => new Map(prev).set(page, patches));
      }
      setCompletedTranslatedPages((prev) => new Set([...prev, page]));
      setShowTranslation(true);
    } catch (err) {
      console.error(`[PageTranslate] Page ${page + 1} failed:`, err);
    } finally {
      setTranslatingCurrentPage(false);
    }
  };

  const chapterLabel = chapterNumber
    ? `ตอนที่ ${chapterNumber}${chapterTitle ? `  ${chapterTitle}` : ""}`
    : (chapterTitle ?? "ตัวอย่างมังงะ");

  const content = (
    <div className={`fixed inset-0 z-300 flex flex-col bg-black transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`}>
      {/* Top bar — z-10 ensures dropdown panel stacks above the reader area (flip buttons etc.) */}
      <div className="relative z-10 flex shrink-0 items-center border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-white/50">{mangaTitle}</p>
          <p className="truncate text-sm font-semibold text-white">{chapterLabel}</p>
        </div>

        {/* Page counter — centered absolutely so it's always in the middle */}
        {(totalPages > 0 || lastValidTotalPagesRef.current > 0) && (
          <span className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 transition-opacity duration-250 ${
            contentReady && !error && totalPages > 0 ? "opacity-100" : "opacity-0"
          }`}>
            {(!contentReady || error ? lastValidTotalPagesRef.current : totalPages) > 0
              ? `${page + 1} / ${!contentReady || error ? lastValidTotalPagesRef.current : totalPages}`
              : ""}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {/* Chapter navigation */}
          {sameLangList.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5">
              <button
                onClick={() => prevSameLang && goToChapter(prevSameLang)}
                disabled={!hasPrev}
                title="ตอนก่อนหน้า"
                className="flex h-8 w-8 items-center justify-center rounded-l-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
              </button>
              <button
                onClick={() => pickerMounted ? closePicker() : openPicker(currentLang ?? "all")}
                title="เลือกตอน"
                className="flex h-8 items-center px-3 text-[11px] text-white/60 select-none whitespace-nowrap transition hover:text-white hover:bg-white/10"
              >
                {chapterNumDisplay !== null && maxMainChapter !== null
                    ? `ตอน ${chapterNumDisplay} / ${maxMainChapter}`
                    : sameLangIdx !== -1 ? `${sameLangIdx + 1} / ${sameLangList.length}` : "ตอน"}
              </button>
              <button
                onClick={() => nextSameLang && goToChapter(nextSameLang)}
                disabled={!hasNext}
                title="ตอนถัดไป"
                className="flex h-8 w-8 items-center justify-center rounded-r-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
              </button>
            </div>
          )}
          <button onClick={() => setUseSaver((s) => !s)} title={useSaver ? "สลับเป็นคุณภาพสูง" : "สลับเป็นโหมดประหยัดข้อมูล"} className="hidden rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white sm:block">
            {useSaver ? "Data Saver" : "HD"}
          </button>

          {/* Translate dropdown — combines lang selector, single-page, batch, and toggle */}
          {data && pages.length > 0 && (() => {
            const source = (currentLang ?? "").toLowerCase();
            const LANGS = TARGET_LANG_OPTIONS.filter((l) => l.code !== source);
            const currentTarget = LANGS.find((l) => l.code === targetLang) ?? LANGS[0];

            const triggerColorCls =
              mitStatus === "offline"
                ? "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:border-amber-400/60"
                : translating
                ? "border-red-400/40 bg-red-500/10 text-red-300 hover:border-red-400/60"
                : (translatedPages.size > 0 || patchedPages.size > 0)
                ? "border-blue-400/40 bg-blue-500/10 text-blue-300 hover:border-blue-400/60"
                : "border-white/20 text-white/70 hover:border-white/40 hover:text-white";

            return (
              <div ref={translateMenuRef} className="relative hidden sm:block">
                {/* Trigger button */}
                <button
                  onClick={() => {
                    if (translating) {
                      cancelTranslate();
                    } else {
                      setTranslateMenuOpen((o) => !o);
                    }
                  }}
                  title={translating ? "หยุดแปล" : "เมนูการแปล"}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${triggerColorCls}`}
                >
                  {/* Status indicator */}
                  {!translating && (
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      mitStatus === "online" ? "bg-green-400"
                      : mitStatus === "offline" ? "bg-red-500"
                      : "bg-white/30"
                    }`} />
                  )}
                  {translating && (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0"><rect x="6" y="6" width="12" height="12" /></svg>
                  )}
                  {translating ? (
                    `${transProgress.done}/${transProgress.total}`
                  ) : (translatedPages.size > 0 || patchedPages.size > 0) ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3 shrink-0"><path d="M5 13l4 4L19 7" /></svg>
                      แปลแล้ว
                    </>
                  ) : mitStatus === "offline" ? (
                    "แปล (ออฟไลน์)"
                  ) : (
                    `แปล ${currentTarget?.label ?? ""}`
                  )}
                  {!translating && (
                    <svg viewBox="0 0 24 24" fill="currentColor" className={`h-3 w-3 shrink-0 transition-transform duration-200 ${translateMenuOpen ? "rotate-180" : ""}`}><path d="M7 10l5 5 5-5z" /></svg>
                  )}
                </button>

                {/* Dropdown panel — Navbar style, always in DOM, shown via CSS transition */}
                <div
                  className={`absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/15 bg-black/70 shadow-2xl backdrop-blur-sm transition-all duration-200 origin-top-right ${
                    translateMenuOpen && !translating
                      ? "pointer-events-auto scale-100 opacity-100"
                      : "pointer-events-none scale-95 opacity-0"
                  }`}
                >
                  {/* Header */}
                  <div className="border-b border-white/10 px-4 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">การแปล AI</p>
                  </div>

                  <div className="p-2">
                    {/* Language selector */}
                    {LANGS.length > 0 && (
                      <div className="mb-1">
                        <div className="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">ภาษาที่แปลออกมา</div>
                        <div className="flex flex-wrap gap-1 px-1 pb-1">
                          {LANGS.map((l) => (
                            <button
                              key={l.code}
                              onClick={() => setTargetLang(l.code)}
                              className={`rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ${
                                currentTarget?.code === l.code
                                  ? "bg-white/15 font-semibold text-white"
                                  : "text-white/60 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {l.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="my-1 border-t border-white/10" />

                    {/* Single-page translate */}
                    <button
                      onClick={() => { translateCurrentPage(); setTranslateMenuOpen(false); }}
                      disabled={translatingCurrentPage}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-purple-300/90 transition-colors duration-150 hover:bg-white/10 hover:text-purple-200 disabled:opacity-50"
                    >
                      {translatingCurrentPage ? (
                        <>
                          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M12 3a9 9 0 0 1 9 9" /></svg>
                          กำลังแปลหน้า {page + 1}...
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 8h10M7 12h6" /></svg>
                          แปลหน้านี้
                        </>
                      )}
                    </button>

                    {/* Batch translate */}
                    <button
                      onClick={() => { startTranslate(); setTranslateMenuOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/65 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><path d="M4 6h16M4 10h16M4 14h10M4 18h6" /></svg>
                      แปลทั้งตอน
                    </button>

                    {/* Show / hide translation toggle */}
                    {(translatedPages.size > 0 || patchedPages.size > 0) && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <button
                          onClick={() => { setShowTranslation((s) => !s); setTranslateMenuOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/65 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          {showTranslation ? "ดูต้นฉบับ" : "ดูฉบับแปล"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Read mode toggle */}
          <div className="flex overflow-hidden rounded-lg border border-white/15 bg-white/5 text-[11px]">
            <button
              onClick={() => setContinuousMode(false)}
              className={`px-2.5 py-1.5 transition ${!continuousMode ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}
              title="โหมดทีละหน้า"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
              </svg>
            </button>
            <button
              onClick={() => setContinuousMode(true)}
              className={`px-2.5 py-1.5 transition ${continuousMode ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}
              title="โหมดอ่านต่อเนื่อง"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M4 4h16v4H4zm0 6h16v4H4zm0 6h16v4H4z" />
              </svg>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-1.5 py-1">
            <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} title="ย่อ" className="flex h-6 w-6 items-center justify-center rounded text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path d="M5 12h14" /></svg>
            </button>
            <button onClick={zoomReset} title="รีเซ็ต" className="min-w-10 rounded px-1 py-0.5 text-center text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="ขยาย" className="flex h-6 w-6 items-center justify-center rounded text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>

          <button onClick={handleClose} title="ปิด" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/15">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Chapter picker popup */}
      {pickerMounted && (() => {
        const allLangs = Array.from(new Set(chapterList.map((c) => c.translatedLanguage))).sort((a, b) => {
          if (a === currentLang) return -1;
          if (b === currentLang) return 1;
          if (a === "th") return -1;
          if (b === "th") return 1;
          return a.localeCompare(b);
        });
        const tabs = ["all", ...allLangs];
        const labelFor = (l: string) =>
          l === "all" ? "ทั้งหมด" : l === "th" ? "ภาษาไทย" : l.toUpperCase();
        const filtered = pickerLangFilter === "all"
          ? chapterList
          : chapterList.filter((c) => c.translatedLanguage === pickerLangFilter);
        return (
          <div
            className={`absolute inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${pickerVisible ? "opacity-100" : "opacity-0"}`}
            onClick={(e) => { if (e.target === e.currentTarget) closePicker(); }}
          >
            <div
              ref={pickerRef}
              className={`relative mx-4 mt-16 flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-900/95 shadow-2xl shadow-black/80 backdrop-blur-xl transition-all duration-300 ${pickerVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
            >
              {/* Picker header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">เลือกตอน</h3>
                <button onClick={closePicker} title="ปิด" className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Language filter tabs */}
              {tabs.length > 2 && (
                <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {tabs.map((l) => (
                    <button
                      key={l}
                      onClick={() => setPickerLangFilter(l)}
                      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition ${
                        pickerLangFilter === l
                          ? "bg-white/20 text-white"
                          : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                      }`}
                    >
                      {labelFor(l)}
                      {l === currentLang && (
                        <span className="ml-1 text-[9px] text-blue-400/80">●</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Chapter list */}
              <div data-lenis-prevent className="flex-1 overflow-y-auto p-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
                <div className="space-y-1">
                  {filtered.map((ch) => {
                    const isCurrent = ch.id === currentChapterId;
                    return (
                      <button
                        key={ch.id}
                        ref={isCurrent ? activeChapterBtnRef : undefined}
                        onClick={() => { goToChapter(ch); closePicker(); }}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition ${
                          isCurrent
                            ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/30"
                            : "border-white/8 hover:border-white/20 hover:bg-white/8"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-white">
                            ตอนที่ {ch.chapterNumber ?? "?"}{ch.title ? ` — ${ch.title}` : ""}
                          </span>
                        </span>
                        {pickerLangFilter === "all" && (
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            ch.translatedLanguage === "th"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-white/8 text-white/40"
                          }`}>
                            {labelFor(ch.translatedLanguage)}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="shrink-0 rounded bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                            กำลังอ่าน
                          </span>
                        )}
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-white/25">
                          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Main reading area */}
      {continuousMode ? (
        /* ── Continuous mode ── */
        <div data-lenis-prevent ref={scrollContainerRef} className="flex flex-1 flex-col items-center overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/50">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
              <span className="text-sm">กำลังโหลดหน้ามังงะ...</span>
            </div>
          )}
          {error && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-white/50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12 opacity-40"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <p className="text-sm">ไม่สามารถโหลดหน้ามังงะได้</p>
            </div>
          )}
          {noCacheError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12 text-yellow-500/60"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" /><path d="M16 3v4M8 3v4M12 12h.01" /></svg>
              <p className="text-sm font-semibold text-yellow-400">ไม่มีข้อมูลใน Cache</p>
              <p className="max-w-xs text-xs text-white/40">รูปภาพตอนนี้ยังไม่ได้ถูกดาวน์โหลดเก็บไว้ในเครื่องยัง ลองอ่านตอนนี้ในโหมดปกติก่อน เพื่อให้ระบบดาวน์โหลดข้อมูลมาเก็บ</p>
            </div>
          )}
          {!loading && !error && data && pages.map((src, i) => {
            const pageIsPending = translating && !completedTranslatedPages.has(i);
            const pageIsDone = completedTranslatedPages.has(i) && patchedPages.has(i);
            return (
              <div key={src} className="relative manga-continuous-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={(el) => { pageRefs.current[i] = el; }}
                  data-page-idx={i}
                  src={showTranslation && translatedPages.has(i) ? translatedPages.get(i)! : src}
                  alt={`หน้า ${i + 1}`}
                  draggable={false}
                  loading="lazy"
                  className="w-full select-none"
                />
                {showTranslation && patchedPages.has(i) && patchedPages.get(i)!.map((p, pi) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={pi}
                    src={p.url}
                    alt=""
                    aria-hidden
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: `${p.xPct * 100}%`,
                      top: `${p.yPct * 100}%`,
                      width: `${p.wPct * 100}%`,
                      height: `${p.hPct * 100}%`,
                      pointerEvents: "none",
                    }}
                  />
                ))}
                {/* Per-page translation status badge — continuous mode */}
                {pageIsPending && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center pb-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-black/75 px-3 py-1 shadow-lg backdrop-blur-sm">
                      <div className="h-2.5 w-2.5 animate-spin rounded-full border border-blue-400/40 border-t-blue-400" />
                      <span className="text-[10px] font-medium text-blue-300">กำลังแปลหน้า {i + 1}...</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Next chapter banner — continuous mode */}
          {!loading && !error && data && (hasNextSameLang || hasNextOtherLang) && (
            <div className="flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
              <p className="text-sm text-white/40">อ่านจบตอนแล้ว</p>
              {hasNextSameLang ? (
                <button
                  onClick={() => goToChapter(nextSameLang!)}
                  className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-white/85 active:scale-95"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                  ตอนถัดไป{nextSameLang!.chapterNumber ? ` (ตอนที่ ${nextSameLang!.chapterNumber})` : ""}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs text-white/50">
                    ไม่มีตอนถัดไปใน{currentLang ? ` ${langLabel(currentLang)}` : ""}
                  </p>
                  <p className="text-xs text-white/35">มีตอนถัดไปในภาษาอื่น:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {Array.from(otherLangNextMap.entries()).map(([lang, ch]) => (
                      <button
                        key={lang}
                        onClick={() => goToChapter(ch)}
                        className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
                      >
                        {langLabel(lang)}{ch.chapterNumber ? ` • ตอนที่ ${ch.chapterNumber}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Paged mode ── */
        <div className={`relative flex flex-1 items-center justify-center overflow-hidden ${zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""}`}>
          {loading && (
            <div className="flex flex-col items-center gap-3 text-white/50">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
              <span className="text-sm">กำลังโหลดหน้ามังงะ...</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3 text-center text-white/50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12 opacity-40"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <p className="text-sm">ไม่สามารถโหลดหน้ามังงะได้</p>
              <p className="text-xs text-white/30">ตอนนี้อาจถูกล็อกหรือยังไม่มีภาพให้อ่าน</p>
            </div>
          )}
          {noCacheError && (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12 text-yellow-500/60">
                <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                <path d="M16 3v4M8 3v4M12 12h.01" />
              </svg>
              <p className="text-sm font-semibold text-yellow-400">ไม่มีข้อมูลใน Cache</p>
              <p className="max-w-xs text-xs text-white/40">รูปภาพตอนนี้ยังไม่ได้ถูกดาวน์โหลดเก็บไว้ในเครื่องยัง ลองอ่านตอนนี้ในโหมดปกติก่อน เพื่อให้ระบบดาวน์โหลดข้อมูลมาเก็บ</p>
            </div>
          )}
          {!loading && !error && !noCacheError && data && totalPages > 0 && (
            <>
              <div ref={zoomWrapperRef} className="manga-zoom-wrapper relative flex items-center justify-center select-none">
                {imgLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                  </div>
                )}
                {/* Tight wrapper so absolute-positioned patches are relative to the img */}
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={showTranslation && translatedPages.has(page) ? `tr-${pages[page]}` : pages[page]}
                    src={showTranslation && translatedPages.has(page) ? translatedPages.get(page)! : pages[page]}
                    alt={`หน้า ${page + 1}`}
                    draggable={false}
                    className={`block max-h-[calc(100vh-120px)] max-w-full transition-opacity duration-200 ${imgLoading ? "opacity-0" : "opacity-100"}`}
                    onLoad={() => setImgLoading(false)}
                    onLoadStart={() => setImgLoading(true)}
                  />
                  {/* Patch overlay: translated text regions overlaid on the original image */}
                  {showTranslation && patchedPages.has(page) && patchedPages.get(page)!.map((p, pi) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={pi}
                      src={p.url}
                      alt=""
                      aria-hidden
                      draggable={false}
                      style={{
                        position: "absolute",
                        left: `${p.xPct * 100}%`,
                        top: `${p.yPct * 100}%`,
                        width: `${p.wPct * 100}%`,
                        height: `${p.hPct * 100}%`,
                        pointerEvents: "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              {zoom === 1 && (
                <>
                  <button onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page === 0} className="absolute left-0 top-0 h-full w-1/3 cursor-pointer disabled:cursor-default" aria-label="หน้าก่อนหน้า" />
                  <button onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))} disabled={page === totalPages - 1} className="absolute right-0 top-0 h-full w-1/3 cursor-pointer disabled:cursor-default" aria-label="หน้าถัดไป" />
                </>
              )}

              {/* Translation status pill — paged mode, floats at bottom of viewing area above the strip */}
              {(translating || translatingCurrentPage) && (
                <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                  {(translating && !completedTranslatedPages.has(page)) || translatingCurrentPage ? (
                    <div className="flex items-center gap-2 rounded-full border border-blue-400/40 bg-black/85 px-4 py-2 shadow-xl shadow-black/60 backdrop-blur-sm">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                      <span className="text-xs font-medium text-blue-300">กำลังแปลหน้า {page + 1}...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/85 px-4 py-2 shadow-xl shadow-black/60 backdrop-blur-sm">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                      <span className="text-xs font-medium text-white/60">แปลไปแล้ว {transProgress.done}/{transProgress.total} หน้า</span>
                    </div>
                  )}
                </div>
              )}

              {page > 0 && (
                <button onClick={() => setPage((p) => Math.max(p - 1, 0))} title="หน้าก่อน" className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/80">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
                </button>
              )}
              {page < totalPages - 1 && (
                <button onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))} title="หน้าถัดไป" className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/80">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                </button>
              )}
              {/* Next chapter banner — paged mode */}
              {page === totalPages - 1 && (hasNextSameLang || hasNextOtherLang) && (
                <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
                  {hasNextSameLang ? (
                    <button
                      onClick={() => goToChapter(nextSameLang!)}
                      className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black shadow-xl shadow-black/50 transition hover:bg-white/85 active:scale-95"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                      ตอนถัดไป{nextSameLang!.chapterNumber ? ` (ตอนที่ ${nextSameLang!.chapterNumber})` : ""}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/85 px-5 py-4 text-center shadow-xl shadow-black/50 backdrop-blur-sm">
                      <p className="text-xs text-white/50">ไม่มีตอนถัดไปใน{currentLang ? ` ${langLabel(currentLang)}` : ""}</p>
                      <p className="mb-1 text-[11px] text-white/30">มีตอนถัดไปในภาษาอื่น:</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {Array.from(otherLangNextMap.entries()).map(([lang, ch]) => (
                          <button
                            key={lang}
                            onClick={() => goToChapter(ch)}
                            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
                          >
                            {langLabel(lang)}{ch.chapterNumber ? ` • ตอนที่ ${ch.chapterNumber}` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Bottom page strip */}
      <div className={`shrink-0 overflow-hidden border-t border-white/10 bg-black/80 transition-all duration-300 ease-in-out ${
        contentReady && !error && totalPages > 0 ? "max-h-14 opacity-100 py-2" : "max-h-0 opacity-0 py-0"
      }`}>
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4">
          {pages.map((_, i: number) => {
            const btnPending = translating && !completedTranslatedPages.has(i);
            const btnDone = patchedPages.has(i);
            return (
              <button
                key={i}
                onClick={() => continuousMode ? scrollToPage(i) : setPage(i)}
                className={`relative flex h-7 min-w-9 shrink-0 items-center justify-center rounded text-[10px] font-medium transition-all duration-200 ${
                  i === page ? "bg-white text-black" : "bg-white/10 text-white/60 hover:bg-white/20"
                } ${
                  btnPending ? "ring-1 ring-blue-400/50" : btnDone ? "ring-1 ring-green-400/50" : ""
                }`}
              >
                {i + 1}
                {/* Status dot */}
                {btnPending && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                )}
                {!btnPending && btnDone && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
