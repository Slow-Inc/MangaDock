"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { addToHistory, getHistory } from "../lib/readingHistory";
import { resolveReaderPages, buildOtherLangNextMap } from "../lib/readerPages";
import { useChapterTranslation, TARGET_LANG_OPTIONS } from "../hooks/useChapterTranslation";
import { buildTranslationSources } from "../lib/translationSources";
import { buildTranslateMenu } from "../lib/translateMenu";
import { formatEta, pillMainText, stageLabel } from "../lib/translationStages";
import { apiFetch } from "../lib/apiFetch";
import { useChapters, type ChapterPageItem } from "../hooks/useChapters";
import { ZOOM_MIN, ZOOM_MAX } from "../lib/zoomLevel";
import { useReaderViewport } from "../hooks/useReaderViewport";
import { useModalTransition } from "../hooks/useModalTransition";
import { useReaderCaptcha } from "../hooks/useReaderCaptcha";
import ReaderCaptchaGate from "./reader/ReaderCaptchaGate";
import ChapterPicker from "./reader/ChapterPicker";
import PageRenderer from "./reader/PageRenderer";
import TranslationFeedback from "./TranslationFeedback";
import ReaderCommentDrawer from "./ReaderCommentDrawer";
import ReportButton from "./ReportButton";

export type ChapterPages = {
  pages: string[];
  dataSaverPages: string[];
  /** Local /img-cache/… paths served by the backend (IMAGE_CACHE_ENABLED=true). */
  localPages?: string[];
  localDataSaverPages?: string[];
  /** Set to false in forceLocal responses when no pages are cached yet. */
  localCacheAvailable?: boolean;
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
const LANG_LABEL: Record<string, string> = { th: "ภาษาไทย", en: "English", ja: "日本語" };

export default function MangaReader({ chapterId: initialChapterId, chapterNumber: initialChapterNumber, chapterTitle: initialChapterTitle, mangaTitle, mangaId, onClose }: Props) {
  // Cloudflare Turnstile state (#582: extracted to useReaderCaptcha).
  const { clearanceToken, turnstilePassed, turnstileExiting, onVerify, resetCaptcha } = useReaderCaptcha();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  // Current chapter state — can change via navigation
  const [currentChapterId, setCurrentChapterId] = useState(initialChapterId);
  const [currentChapterNumber, setCurrentChapterNumber] = useState(initialChapterNumber);
  const [currentChapterTitle, setCurrentChapterTitle] = useState(initialChapterTitle);

  // Chapter list for navigation (#302: fetch+merge lives in useChapters)
  const chapterList = useChapters(mangaId);
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
  const otherLangNextMap = useMemo(
    () => buildOtherLangNextMap(chapterList, currentIdx, currentChapterNum, currentLang),
    [chapterList, currentIdx, currentChapterNum, currentLang],
  );

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

  const langLabel = useCallback((l: string) => LANG_LABEL[l] ?? l.toUpperCase(), []);

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
  const [commentOpen, setCommentOpen] = useState(false);
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);
  const translateMenuRef = useRef<HTMLDivElement | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  // Translate from the SAME derivative the Reader displays (#156) — a patch
  // generated from a different encode of the page sits in a visibly
  // different screentone tone than its surroundings.
  const { sources: translationSources, derivative } = buildTranslationSources(data, useSaver);

  // All translate orchestration lives in the hook (#142); both the desktop
  // dropdown and the mobile sheet render from this single state bundle.
  const {
    mitStatus,
    translating,
    translatingCurrentPage,
    translatingCurrentPageIndex,
    transProgress,
    pageElapsedSec,
    etaSec,
    coldStart,
    currentStage,
    translatedPages,
    patchedPages,
    completedTranslatedPages,
    showTranslation,
    setShowTranslation,
    targetLang,
    setTargetLang,
    imageModel,
    selectImageModel,
    availableModels,
    showModelSelector,
    startTranslate,
    cancelTranslate,
    translateCurrentPage,
  } = useChapterTranslation(currentChapterId, translationSources, {
    sourceLang: currentLang,
    currentPage: page,
    menusOpen: translateMenuOpen || moreMenuOpen,
    derivative,
    // Series context (#157): the Backend resolves title/synopsis from the
    // catalog so the translator knows which manga it is translating.
    mangaId,
    // Captcha expiry mid-translate (#227): drop the stale clearance token and
    // re-open the Turnstile modal — same reset the page-fetch 401 path uses.
    onCaptchaExpired: resetCaptcha,
  });

  // Perceived-progress strings: ticking seconds + live MIT stage + honest ETA
  // keep the 20-60s per-page wait from reading as a frozen spinner.
  const stageInfo = stageLabel(currentStage?.stage ?? null);
  const translateDetail = [
    pageElapsedSec > 0 ? `${pageElapsedSec} วิ` : null,
    stageInfo ? `${stageInfo.text} (${stageInfo.step}/${stageInfo.total})` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const translateSubline = coldStart
    ? "กำลังโหลดโมเดล AI — หน้าแรกมักใช้เวลา ~1 นาที"
    : etaSec !== null
      ? `เหลือ ${formatEta(etaSec)}`
      : null;
  const [imgLoading, setImgLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  // Default to continuous mode on mobile (< 640px) for better UX
  const [continuousMode, setContinuousMode] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640
  );

  // Track last valid page count so the counter can show it during fade-out.
  // State (not a ref) — it's read during render, which react-hooks/refs forbids.
  const [lastValidTotalPages, setLastValidTotalPages] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { mounted: pickerMounted, visible: pickerVisible } = useModalTransition(pickerOpen, {
    duration: 300,
  });
  const showChapterPickerRef = useRef(false);
  const [pickerLangFilter, setPickerLangFilter] = useState<string>("all");
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerScrollRef = useRef<HTMLDivElement>(null);
  const activeChapterBtnRef = useRef<HTMLButtonElement>(null);

  const openPicker = (lang: string) => {
    setPickerLangFilter(lang);
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
  };

  // Sync picker open state to ref for ESC handler
  useEffect(() => { showChapterPickerRef.current = pickerMounted; }, [pickerMounted]);

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

  // Close mobile more menu on outside click
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreMenuOpen]);

  const stripScrollRef = useRef<HTMLDivElement>(null);
  const activeStripBtnRef = useRef<HTMLButtonElement>(null);

  // Viewport: shared refs, continuous-mode Lenis, page-visibility sync, and
  // zoom/pan — all extracted to useReaderViewport (#582). Destructured to local
  // names (not `viewport.foo`) because eslint's react-hooks/refs rule can't
  // statically prove a nested `viewport.refs.foo` member expression is a ref
  // object, and flags every JSX `ref={...}` use as an unsafe render-time access.
  const viewport = useReaderViewport({ page, setPage, data, continuousMode });
  const {
    zoom,
    isDragging,
    zoomIn,
    zoomOut,
    zoomReset,
    resetZoomAndPan,
    continuousLenisRef,
    refs: { scrollContainerRef, continuousContentRef, pageRefs, continuousModeRef },
  } = viewport;

  // Auto-scroll bottom strip to keep current page button visible
  // Debounced so rapid page updates (continuous mode scroll) don't spam smooth-scrolls
  const stripScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (stripScrollTimerRef.current) clearTimeout(stripScrollTimerRef.current);
    stripScrollTimerRef.current = setTimeout(() => {
      const btn = activeStripBtnRef.current;
      const container = stripScrollRef.current;
      if (!btn || !container) return;
      const btnLeft = btn.offsetLeft;
      const btnWidth = btn.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollTo = btnLeft - containerWidth / 2 + btnWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollTo), behavior: "smooth" });
    }, 80);
  }, [page]);

  const goToChapter = useCallback((ch: ChapterPageItem) => {
    setCurrentChapterId(ch.id);
    setCurrentChapterNumber(ch.chapterNumber);
    setCurrentChapterTitle(ch.title);
  }, []);

  // Chapter picker row selection: navigate then close the picker.
  const handleSelectChapter = (ch: ChapterPageItem) => {
    goToChapter(ch);
    closePicker();
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- mount flag + chapter-change
       reset before fetching; resetting via a key-remount would also drop the
       open/close fade animation and the portal mount gate. */
    setMounted(true);
    setPage(0);
    setData(null);
    setError(false);
    setNoCacheError(false);
    setLoading(true);
    setContentReady(false);
    if (contentReadyTimerRef.current) clearTimeout(contentReadyTimerRef.current);
    resetZoomAndPan();
    /* eslint-enable react-hooks/set-state-in-effect */
    requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";

    if (!turnstilePassed && !chapterId.startsWith("ver:")) return;

    // User-uploaded version: fetch pages from /versions/:versionId
    const isUserVersion = chapterId.startsWith("ver:");
    if (isUserVersion) {
      const versionId = chapterId.slice(4);
      apiFetch(`${API_BASE}/versions/${versionId}`)
        .then((r) => {
          if (!r.ok) throw new Error("not ok");
          return r.json();
        })
        .then((ver: { pages?: string[]; backendAvailable?: boolean }) => {
          const pages = ver.pages ?? [];
          if (ver.backendAvailable === false || pages.length === 0) { setError(true); }
          else {
            // Convert version pages to ChapterPages format
            // Pages are relative URLs like /uploads/chapters/...
            const resolvedPages = pages.map((p) => p.startsWith("/") ? `${API_BASE}${p}` : p);
            setData({ pages: resolvedPages, dataSaverPages: resolvedPages });
          }
          setLoading(false);
          contentReadyTimerRef.current = setTimeout(() => setContentReady(true), 300);
          if (mangaId) {
            const existing = getHistory().find((h) => h.id === mangaId);
            if (existing) {
              addToHistory({ ...existing, lastChapterId: chapterId, lastChapterNumber: chapterNumber ?? null });
            }
          }
        })
        .catch(() => { setError(true); setLoading(false); contentReadyTimerRef.current = setTimeout(() => setContentReady(true), 300); });
      return () => { document.body.style.overflow = ""; };
    }

    const _pageParams = new URLSearchParams();
    if (localStorage.getItem("imgCacheForceLocal") === "1") _pageParams.set("forceLocal", "true");
    if (mangaId) _pageParams.set("mangaId", mangaId);
    const _pageQuery = _pageParams.size > 0 ? `?${_pageParams.toString()}` : "";
    apiFetch(`${API_BASE}/books/chapters/${chapterId}/pages${_pageQuery}`, {
      headers: {
        'x-captcha-clearance': clearanceToken || '',
      }
    })
      .then((r) => {
        if (r.status === 401) {
          resetCaptcha();
          throw new Error("unauthorized");
        }
        if (!r.ok) throw new Error("not ok");
        return r.json();
      })
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
  }, [chapterId, turnstilePassed, clearanceToken, resetCaptcha, resetZoomAndPan]);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 250); };

  // Prefer locally-cached paths when available (backend IMAGE_CACHE_ENABLED=true).
  // Non-cached pages are routed through the img-proxy so the browser never hits
  // MangaDex CDN directly — a direct request sends the VPS URL as Referer which
  // MangaDex blocks with their "You can read this at mangadex.org" banner image.
  // Prefer locally-cached paths when available; non-cached pages route through
  // the img-proxy. Memoized so translation-timer ticks / scroll setPage don't
  // re-encode every URL and churn the array identity (plan 2026-07-11 Perf 2).
  const pages = useMemo(
    () => useSaver
      ? resolveReaderPages(data?.dataSaverPages ?? [], data?.localDataSaverPages, API_BASE)
      : resolveReaderPages(data?.pages ?? [], data?.localPages, API_BASE),
    [data, useSaver],
  );
  const totalPages = pages.length;
  const hasAnyTranslation = translatedPages.size > 0 || patchedPages.size > 0 || completedTranslatedPages.size > 0;
  const hasFullTranslation = totalPages > 0 && completedTranslatedPages.size >= totalPages;
  const hasPartialTranslation = hasAnyTranslation && !hasFullTranslation;
  // One model drives the desktop dropdown AND the mobile sheet (#162) — a
  // fully-translated chapter offers a single view toggle, never dead
  // translate buttons.
  const translateMenu = buildTranslateMenu({
    totalPages,
    completedCount: completedTranslatedPages.size,
    hasAnyTranslation,
    showTranslation,
  });

  // Keep last valid page count so counter can show it during chapter-change
  // fade-out — adjusted during render (React's "storing information from
  // previous renders" pattern), not in an effect.
  if (contentReady && totalPages > 0 && totalPages !== lastValidTotalPages) {
    setLastValidTotalPages(totalPages);
  }

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
    // continuousLenisRef/continuousModeRef/scrollContainerRef are stable ref
    // objects from useReaderViewport (identity never changes) — listed here
    // only so eslint's exhaustive-deps can see they're accounted for; it can't
    // infer their stability across a custom-hook boundary the way it does for
    // a same-component `useRef()` call.
  }, [totalPages, continuousLenisRef, continuousModeRef, scrollContainerRef]);

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
  }, [continuousModeRef]);

  // Scroll to page when clicking page strip in continuous mode
  const scrollToPage = (idx: number) => {
    const el = pageRefs.current[idx];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chapterLabel = chapterNumber
    ? `ตอนที่ ${chapterNumber}${chapterTitle ? `  ${chapterTitle}` : ""}`
    : (chapterTitle ?? "ตัวอย่างมังงะ");

  const content = (
    <div className={`fixed inset-0 z-300 flex flex-col bg-black transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`}>
      <ReaderCaptchaGate
        passed={turnstilePassed}
        exiting={turnstileExiting}
        siteKey={turnstileSiteKey}
        chapterLabel={chapterLabel}
        onVerify={onVerify}
      >
        {/* Top bar — z-10 ensures dropdown panel stacks above the reader area (flip buttons etc.) */}
        <div className="relative z-10 flex shrink-0 items-center border-b border-white/10 bg-black/80 px-2 py-2 sm:px-4 sm:py-3 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-white/50">{mangaTitle}</p>
            <p className="truncate text-sm font-semibold text-white">{chapterLabel}</p>
          </div>

          {/* Page counter — centered absolutely so it's always in the middle, hidden on mobile */}
          {(totalPages > 0 || lastValidTotalPages > 0) && (
            <span className={`pointer-events-none hidden sm:inline absolute left-1/2 -translate-x-1/2 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 transition-opacity duration-250 ${
              contentReady && !error && totalPages > 0 ? "opacity-100" : "opacity-0"
            }`}>
              {(!contentReady || error ? lastValidTotalPages : totalPages) > 0
                ? `${page + 1} / ${!contentReady || error ? lastValidTotalPages : totalPages}`
                : ""}
            </span>
          )}

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                  className="flex h-8 items-center px-3 text-xs text-white/60 select-none whitespace-nowrap transition hover:text-white hover:bg-white/10"
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
                  : hasAnyTranslation
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
                      `${transProgress.done}/${transProgress.total}${transProgress.failed > 0 ? ` ✕${transProgress.failed}` : ""}`
                    ) : hasFullTranslation ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3 shrink-0"><path d="M5 13l4 4L19 7" /></svg>
                        แปลแล้ว
                      </>
                    ) : hasPartialTranslation ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3 shrink-0"><path d="M12 6v6l4 2" /><circle cx="12" cy="12" r="9" /></svg>
                        แปลบางหน้า
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
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">การแปล AI</p>
                    </div>

                    <div className="p-2">
                      {/* Language selector */}
                      {LANGS.length > 0 && (
                        <div className="mb-1">
                          <div className="mb-1.5 px-2 pt-1 text-xs font-semibold uppercase tracking-widest text-white/35">ภาษาที่แปลออกมา</div>
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

                      {/* Image-translation model selector (#87) — Gemini deployments only (#134) */}
                      {showModelSelector && availableModels.length > 0 && (
                        <div className="mb-1">
                          <div className="mb-1.5 px-2 pt-1 text-xs font-semibold uppercase tracking-widest text-white/35">โมเดล AI</div>
                          <div className="flex flex-wrap gap-1 px-1 pb-1">
                            <button
                              onClick={() => selectImageModel(null)}
                              className={`rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ${
                                imageModel === null
                                  ? "bg-white/15 font-semibold text-white"
                                  : "text-white/60 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              อัตโนมัติ
                            </button>
                            {availableModels.map((m) => (
                              <button
                                key={m}
                                onClick={() => selectImageModel(m)}
                                className={`rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ${
                                  imageModel === m
                                    ? "bg-white/15 font-semibold text-white"
                                    : "text-white/60 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {m.replace(/^gemini-/, "")}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="my-1 border-t border-white/10" />

                      {/* Translate actions — hidden once the chapter is fully
                          translated (#162): a translate button that has nothing
                          left to translate is a dead button. */}
                      {translateMenu.showTranslateButtons && (
                        <>
                          {/* Single-page translate */}
                          <button
                            onClick={() => { translateCurrentPage(); setTranslateMenuOpen(false); }}
                            disabled={translatingCurrentPage}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-purple-300/90 transition-colors duration-150 hover:bg-white/10 hover:text-purple-200 disabled:opacity-50"
                          >
                            {translatingCurrentPage ? (
                              <>
                                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M12 3a9 9 0 0 1 9 9" /></svg>
                                กำลังแปลหน้า {(translatingCurrentPageIndex ?? page) + 1}...
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
                        </>
                      )}

                      {/* Show / hide translation toggle */}
                      {translateMenu.viewToggleLabel && (
                        <>
                          {translateMenu.showTranslateButtons && <div className="my-1 border-t border-white/10" />}
                          <button
                            onClick={() => { setShowTranslation((s) => !s); setTranslateMenuOpen(false); }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/65 transition-colors duration-150 hover:bg-white/10 hover:text-white"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            {translateMenu.viewToggleLabel}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Read mode toggle — hidden on mobile, shown in more menu */}
            <div className="hidden sm:flex overflow-hidden rounded-lg border border-white/15 bg-white/5 text-xs">
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

            {/* Zoom controls — hidden on mobile, shown in more menu */}
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-1.5 py-1">
              <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} title="ย่อ" className="flex h-6 w-6 items-center justify-center rounded text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path d="M5 12h14" /></svg>
              </button>
              <button onClick={zoomReset} title="รีเซ็ต" className="min-w-10 rounded px-1 py-0.5 text-center text-xs text-white/70 transition hover:bg-white/10 hover:text-white">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="ขยาย" className="flex h-6 w-6 items-center justify-center rounded text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>

            {/* Mobile more menu (⋮) — visible only on mobile */}
            <div ref={moreMenuRef} className="relative sm:hidden">
              <button
                onClick={() => setMoreMenuOpen((o) => !o)}
                title="เพิ่มเติม"
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-white/70 transition hover:bg-white/15 hover:text-white ${
                  moreMenuOpen ? "border-white/40 bg-white/10 text-white" : "border-white/20"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>

              {/* Mobile dropdown panel */}
              <div
                className={`absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-white/15 bg-black/95 shadow-2xl backdrop-blur-xl transition-all duration-200 origin-top-right ${
                  moreMenuOpen
                    ? "pointer-events-auto scale-100 opacity-100"
                    : "pointer-events-none scale-95 opacity-0"
                }`}
              >
                {/* Zoom section */}
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">ซูม</p>
                  <div className="flex items-center gap-2">
                    <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-30">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M5 12h14" /></svg>
                    </button>
                    <button onClick={zoomReset} className="flex-1 rounded-lg bg-white/10 py-1.5 text-center text-xs text-white/70 transition hover:bg-white/20 hover:text-white">
                      {Math.round(zoom * 100)}%
                    </button>
                    <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-30">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>
                </div>

                {/* Read mode section */}
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">โหมดอ่าน</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setContinuousMode(false)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition ${
                        !continuousMode ? "bg-white/20 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" /></svg>
                      ทีละหน้า
                    </button>
                    <button
                      onClick={() => setContinuousMode(true)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition ${
                        continuousMode ? "bg-white/20 text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M4 4h16v4H4zm0 6h16v4H4zm0 6h16v4H4z" /></svg>
                      ต่อเนื่อง
                    </button>
                  </div>
                </div>

                {/* Data saver section */}
                <div className={`${data && pages.length > 0 ? "border-b border-white/10" : ""} px-4 py-3`}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">คุณภาพ</p>
                  <button
                    onClick={() => setUseSaver((s) => !s)}
                    className="flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    <span>{useSaver ? "Data Saver" : "HD"}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${
                      useSaver ? "bg-amber-500/20 text-amber-300" : "bg-green-500/20 text-green-300"
                    }`}>
                      {useSaver ? "ประหยัดข้อมูล" : "คุณภาพสูง"}
                    </span>
                  </button>
                </div>

                {/* Translate section — only when data available */}
                {data && pages.length > 0 && (() => {
                  const source = (currentLang ?? "").toLowerCase();
                  const LANGS = TARGET_LANG_OPTIONS.filter((l) => l.code !== source);
                  const currentTarget = LANGS.find((l) => l.code === targetLang) ?? LANGS[0];
                  return (
                    <div className="px-4 py-3">
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">การแปล AI</p>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          mitStatus === "online" ? "bg-green-400" : mitStatus === "offline" ? "bg-red-500" : "bg-white/30"
                        }`} />
                      </div>

                      {/* Language selector */}
                      {LANGS.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {LANGS.map((l) => (
                            <button
                              key={l.code}
                              onClick={() => setTargetLang(l.code)}
                              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                                currentTarget?.code === l.code
                                  ? "bg-white/15 font-semibold text-white"
                                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {l.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Image-translation model selector (#87) — Gemini deployments only (#134) */}
                      {showModelSelector && availableModels.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          <button
                            onClick={() => selectImageModel(null)}
                            className={`rounded-lg px-3 py-1.5 text-xs transition ${
                              imageModel === null
                                ? "bg-white/15 font-semibold text-white"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            อัตโนมัติ
                          </button>
                          {availableModels.map((m) => (
                            <button
                              key={m}
                              onClick={() => selectImageModel(m)}
                              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                                imageModel === m
                                  ? "bg-white/15 font-semibold text-white"
                                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {m.replace(/^gemini-/, "")}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Translate actions — hidden when fully translated (#162) */}
                      <div className="space-y-1">
                        {translateMenu.showTranslateButtons && (<>
                        <button
                          onClick={() => { translateCurrentPage(); setMoreMenuOpen(false); }}
                          disabled={translatingCurrentPage || translating}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-purple-300/90 transition hover:bg-white/10 hover:text-purple-200 disabled:opacity-50"
                        >
                          {translatingCurrentPage ? (
                            <>
                              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="9" strokeOpacity="0.3" /><path d="M12 3a9 9 0 0 1 9 9" /></svg>
                              กำลังแปลหน้า {(translatingCurrentPageIndex ?? page) + 1}...
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 8h10M7 12h6" /></svg>
                              แปลหน้านี้
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => { if (translating) { cancelTranslate(); } else { startTranslate(); setMoreMenuOpen(false); } }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/65 transition hover:bg-white/10 hover:text-white"
                        >
                          {translating ? (
                            <>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0"><rect x="6" y="6" width="12" height="12" /></svg>
                              หยุดแปล ({transProgress.done}/{transProgress.total}{transProgress.failed > 0 ? ` ✕${transProgress.failed}` : ""})
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><path d="M4 6h16M4 10h16M4 14h10M4 18h6" /></svg>
                              แปลทั้งตอน
                            </>
                          )}
                        </button>
                        </>)}
                        {translateMenu.viewToggleLabel && (
                          <button
                            onClick={() => { setShowTranslation((s) => !s); setMoreMenuOpen(false); }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/65 transition hover:bg-white/10 hover:text-white"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            {translateMenu.viewToggleLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {mangaId && (
              <>
                <button onClick={() => setCommentOpen(true)} title="ความคิดเห็น" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:bg-white/15 hover:text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                </button>
                <ReportButton contentType="manga" contentId={mangaId} />
              </>
            )}
            <button onClick={handleClose} title="ปิด" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Chapter picker popup (#582: extracted to ChapterPicker) */}
        <ChapterPicker
          mounted={pickerMounted}
          visible={pickerVisible}
          langFilter={pickerLangFilter}
          setLangFilter={setPickerLangFilter}
          chapterList={chapterList}
          currentChapterId={currentChapterId}
          onSelect={handleSelectChapter}
          onClose={closePicker}
          pickerRef={pickerRef}
          pickerScrollRef={pickerScrollRef}
          activeChapterBtnRef={activeChapterBtnRef}
        />

        {/* Main reading area — page render (img blocks, zoom wrapper, nav
            buttons, next-chapter banners) is extracted to PageRenderer (#582).
            The container refs below (scrollContainerRef/continuousContentRef)
            must attach as soon as the reader mounts — useReaderViewport's Lenis
            setup reads them before chapter data has loaded — so their elements
            stay here, unconditional on `data`; PageRenderer itself is only ever
            instantiated once `data` exists (its `data` prop is non-null). */}
        {continuousMode ? (
          /* ── Continuous mode ── */
          <div data-lenis-prevent ref={scrollContainerRef} className="flex flex-1 flex-col items-center overflow-y-auto custom-scrollbar">
            <div ref={continuousContentRef} className="flex w-full flex-col items-center">
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
            {data && (
              <PageRenderer
                viewport={viewport}
                data={data}
                page={page}
                setPage={setPage}
                continuousMode={continuousMode}
                pages={pages}
                totalPages={totalPages}
                showTranslation={showTranslation}
                translatedPages={translatedPages}
                patchedPages={patchedPages}
                completedTranslatedPages={completedTranslatedPages}
                translating={translating}
                translatingCurrentPageIndex={translatingCurrentPageIndex}
                currentStage={currentStage}
                translateDetail={translateDetail}
                imgLoading={imgLoading}
                setImgLoading={setImgLoading}
                hasNextSameLang={hasNextSameLang}
                hasNextOtherLang={hasNextOtherLang}
                nextSameLang={nextSameLang}
                otherLangNextMap={otherLangNextMap}
                currentLang={currentLang}
                langLabel={langLabel}
                goToChapter={goToChapter}
              />
            )}
            </div>
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
            {data && (
              <>
                <PageRenderer
                  viewport={viewport}
                  data={data}
                  page={page}
                  setPage={setPage}
                  continuousMode={continuousMode}
                  pages={pages}
                  totalPages={totalPages}
                  showTranslation={showTranslation}
                  translatedPages={translatedPages}
                  patchedPages={patchedPages}
                  completedTranslatedPages={completedTranslatedPages}
                  translating={translating}
                  translatingCurrentPageIndex={translatingCurrentPageIndex}
                  currentStage={currentStage}
                  translateDetail={translateDetail}
                  imgLoading={imgLoading}
                  setImgLoading={setImgLoading}
                  hasNextSameLang={hasNextSameLang}
                  hasNextOtherLang={hasNextOtherLang}
                  nextSameLang={nextSameLang}
                  otherLangNextMap={otherLangNextMap}
                  currentLang={currentLang}
                  langLabel={langLabel}
                  goToChapter={goToChapter}
                />
                {showTranslation && mangaId && (
                  <div className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2">
                    <TranslationFeedback mangaId={mangaId} chapterId={chapterId} pageNumber={page + 1} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Translation status pill — view-mode agnostic (#164): rendered above
            BOTH the paged area and the continuous strip, so switching modes
            never makes a running translation look idle. The continuous strip's
            per-page badges scroll out of view; this pill never does. */}
        {(translating || translatingCurrentPage) && (
          <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 -translate-x-1/2">
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-blue-400/40 bg-black/85 px-4 py-2 shadow-xl shadow-black/60 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                <span className="text-xs font-medium text-blue-300">
                  {pillMainText(translating, transProgress.done, transProgress.total, (translatingCurrentPageIndex ?? page) + 1)}
                  {translateDetail ? ` · ${translateDetail}` : "..."}
                </span>
                {transProgress.failed > 0 && (
                  <span className="text-xs font-medium text-red-400">ไม่สำเร็จ {transProgress.failed}</span>
                )}
              </div>
              {translateSubline && (
                <span className="text-xs text-white/40">{translateSubline}</span>
              )}
            </div>
          </div>
        )}

        {/* Bottom page strip */}
        <div className={`shrink-0 overflow-hidden border-t border-white/10 bg-black/80 transition-all duration-300 ease-in-out ${
          contentReady && !error && totalPages > 0 ? "max-h-10 opacity-100 pt-0.5 pb-2.5" : "max-h-0 opacity-0 py-0"
        }`}>
          <div ref={stripScrollRef} className="flex gap-1 overflow-x-auto px-4 pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pages.map((_, i: number) => {
              const btnCurrentTranslating = translatingCurrentPageIndex === i;
              const btnQueued = translating && !completedTranslatedPages.has(i) && !btnCurrentTranslating;
              const btnDone = patchedPages.has(i);
              return (
                <button
                  key={i}
                  ref={i === page ? activeStripBtnRef : undefined}
                  onClick={() => continuousMode ? scrollToPage(i) : setPage(i)}
                  className={`relative flex h-7 min-w-9 shrink-0 items-center justify-center rounded-md text-xs font-medium transition-[background-color,color,box-shadow,transform] duration-700 ease-out ${
                    i === page
                      ? "bg-white/90 text-black shadow-[0_0_0_1px_rgba(255,255,255,0.52),0_0_14px_rgba(255,255,255,0.12)]"
                      : "bg-white/8 text-white/55 shadow-[0_0_0_1px_rgba(255,255,255,0)] hover:bg-white/14"
                  } ${
                    btnCurrentTranslating
                      ? "ring-1 ring-slate-300/70 animate-pulse [animation-duration:1.8s]"
                      : btnQueued
                      ? "ring-1 ring-slate-500/55"
                      : btnDone
                      ? "ring-1 ring-white/55"
                      : ""
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </ReaderCaptchaGate>

      {mangaId && (
        <ReaderCommentDrawer
          open={commentOpen}
          onClose={() => setCommentOpen(false)}
          mangaId={mangaId}
          chapterId={chapterId}
          pageNumber={page + 1}
        />
      )}
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
