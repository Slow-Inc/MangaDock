"use client";

import Image from "next/image";
import { errMessage } from "@/lib/errMessage";
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import type Lenis from "lenis";
import { createPortal } from "react-dom";
import CoverLightbox from "./CoverLightbox";
import GeminiBadge from "./GeminiBadge";
import MangaReader from "./MangaReader";
import { addToHistory, getHistory } from "../lib/readingHistory";
import { useBookActions } from "../hooks/useBookActions";
import { useLocalLenis } from "../hooks/useLocalLenis";
import { resolvedThumbnail, proxyImageUrl } from "../lib/imgUrl";
import { chapterAccess } from "../lib/chapterAccess";
import { useAuth } from "../contexts/AuthContext";
import { getWalletBalance, purchaseUnlock, getUnlocksForTitle, topupCoins } from "../lib/studioApi";
import MangaDiscussion from "./MangaDiscussion";
import type { LandingBook, MangaDetail, MangaChapter } from "../lib/types";

type ActiveChapter = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
};

type Props = {
  book: LandingBook;
  onClose: () => void;
  scrollToChapters?: boolean;
  highlightChapterId?: string;
  asPage?: boolean;
};

const API_BASE = "/api/proxy";

function isMangaDex(book: LandingBook) {
  // MangaDex IDs are UUIDs (e.g. aec5b821-ca9d-4273-bece-cd3385a9cc8c)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(book.id);
  return isUUID || book.thumbnail.includes("mangadex.org");
}

// Auto-scrolling title for mobile sticky header when text overflows.
// Uses a CSS custom property (--marquee-overflow) set as inline style so the
// keyframe can reference the real pixel distance without JS-driven animation.
function MarqueeTitle({ title, active, className }: { title: string; active: boolean; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    const measure = () => {
      setOverflow(Math.max(0, text.scrollWidth - container.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [title]);

  const shouldScroll = active && overflow > 0;
  const duration = Math.max(5, overflow / 25);

  return (
    <div ref={containerRef} className={`min-w-0 flex-1 overflow-hidden${className ? ` ${className}` : ""}`}>
      <span
        ref={textRef}
        className="inline-block whitespace-nowrap text-sm font-semibold tracking-[0.01em] text-white/98"
        style={
          shouldScroll
            ? ({
                '--marquee-overflow': `${overflow}px`,
                animation: `marquee-title ${duration}s linear 1s infinite`,
              } as React.CSSProperties)
            : {}
        }
      >
        {title}
      </span>
    </div>
  );
}

export default function BookDetailModal({ book, onClose, scrollToChapters = false, highlightChapterId, asPage = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const { favorited, liked, handleToggleFavorite, handleToggleLiked } = useBookActions(book);

  // Auto-detect last read chapter from history when prop is not explicitly provided
  const effectiveHighlightId = highlightChapterId
    ?? getHistory().find((h) => h.id === book.id)?.lastChapterId;

  const [detail, setDetail] = useState<MangaDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [langFilter, setLangFilter] = useState<string>("all");
  const [activeChapter, setActiveChapter] = useState<ActiveChapter | null>(null);
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [translatingDesc, setTranslatingDesc] = useState(false);
  const [showOriginalDesc, setShowOriginalDesc] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const coverRowRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<HTMLDivElement>(null); // For scrolling to start
  const highlightChapterRef = useRef<HTMLButtonElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const chaptersListScrollRef = useRef<HTMLDivElement>(null);
  const chaptersContentRef = useRef<HTMLDivElement>(null);
  const chaptersLenisRef = useRef<Lenis | null>(null);
  const closingRef = useRef(false);
  const historyPushedRef = useRef(false);
  
  const [isHoveringCovers, setIsHoveringCovers] = useState(false);
  const [coverCanScrollLeft, setCoverCanScrollLeft] = useState(false);
  const [coverCanScrollRight, setCoverCanScrollRight] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Coin / Unlock state
  const { user, getIdToken } = useAuth();
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [unlockedVersions, setUnlockedVersions] = useState<Set<string>>(new Set());
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState(100);
  const [topupLoading, setTopupLoading] = useState(false);

  const lenisRef = useRef<any>(null);

  // Main modal body smooth scroll
  useLocalLenis(modalScrollRef, "vertical", !asPage && visible && activeChapter === null, lenisRef, modalContentRef);

  // Inner chapters list smooth scroll (wrapper = max-h-72 viewport, content = growing inner div)
  useLocalLenis(chaptersListScrollRef, "vertical", !asPage && visible && activeChapter === null && chapters.length > 0, chaptersLenisRef, chaptersContentRef);

  // When inner chapters content grows (expand animation), tell Lenis the new scrollHeight.
  // deps include chapters.length so this re-runs once the div is actually rendered.
  // ResizeObserver then fires on every paint during the 300ms CSS grid-template-rows animation.
  useEffect(() => {
    const el = chaptersContentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => chaptersLenisRef.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [chapters.length]);

  const updateCoverScroll = () => {
    const el = coverRowRef.current;
    if (!el) return;
    setCoverCanScrollLeft(el.scrollLeft > 0);
    setCoverCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  const scrollCovers = (dir: "left" | "right") => {
    const el = coverRowRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  const handleCoverRowWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Separate effect: trigger fade-in only AFTER mounted render is painted
  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  const isManga = isMangaDex(book);

  // Re-check cover row scroll state after detail loads
  useEffect(() => {
    if (!detail) return;
    requestAnimationFrame(updateCoverScroll);
  }, [detail]);

  useEffect(() => {
    setMounted(true);

    // On mobile modal, push a history entry so the hardware back button closes
    if (!asPage && window.innerWidth < 768) {
      window.history.pushState({ mbModal: book.id }, "");
      historyPushedRef.current = true;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    const onPop = () => {
      if (!historyPushedRef.current) return;
      historyPushedRef.current = false;
      if (!closingRef.current) {
        closingRef.current = true;
        setVisible(false);
        setTimeout(onClose, 300);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    if (!asPage) document.body.style.overflow = "hidden";

    if (isManga) {
      setLoadingDetail(true);
      setLoadingChapters(true);

      const forceLocal = localStorage.getItem("imgCacheForceLocal") === "1";
      const qs = forceLocal ? "?forceLocal=true" : "";

      // Auto-translate description (#151): start immediately from the card's
      // description — only wait for the detail fetch when the card had none.
      const translateDesc = (text: string) => {
        setTranslatingDesc(true);
        fetch(`${API_BASE}/books/translate?text=${encodeURIComponent(text)}`)
          .then((r) => r.json())
          .then((trans: { translatedText: string; translated: boolean }) => {
            if (trans.translated) setTranslatedDesc(trans.translatedText);
            setTranslatingDesc(false);
          })
          .catch(() => setTranslatingDesc(false));
      };
      if (book.description) translateDesc(book.description);

      fetch(`${API_BASE}/books/manga/${book.id}${qs}`)
        .then((r) => r.json())
        .then((d: MangaDetail) => {
          setDetail(d);
          setLoadingDetail(false);
          if (!book.description && d.description) translateDesc(d.description);
        })
        .catch(() => setLoadingDetail(false));

      // Chapters + user versions in parallel (#151) — independent requests
      // that were a pure waterfall before (versions only merges at the end).
      Promise.all([
        fetch(`${API_BASE}/books/manga/${book.id}/chapters${qs}`).then((r) => r.json()),
        fetch(`${API_BASE}/versions/title/${book.id}`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []), // versions failure → MangaDex chapters only
      ])
        .then(([mangaDexChapters, versions]: [MangaChapter[], any[]]) => {
          // Tag MangaDex chapters with source
          const tagged = mangaDexChapters.map((ch) => ({ ...ch, source: "mangadex" as const }));
          const userChapters: MangaChapter[] = (versions ?? []).map((v: any) => ({
            id: `ver:${v.versionId}`,
            chapterNumber: v.chapterNumber || null,
            title: v.chapterTitle || null,
            translatedLanguage: v.language || "th",
            uploadedAt: v.createdAt || "",
            pageCount: v.pages?.length ?? 0,
            readerAvailable: v.backendAvailable !== false,
            source: "user" as const,
            translatorName: v.translatorName ?? null,
            priceCoins: v.priceCoins ?? 0,
            versionId: v.versionId,
            backendAvailable: v.backendAvailable !== false,
          }));
          // Merge: MangaDex first, then user-uploaded, sort by chapter number
          const merged = [...tagged, ...userChapters].sort((a, b) => {
            const numA = parseFloat(a.chapterNumber ?? "0") || 0;
            const numB = parseFloat(b.chapterNumber ?? "0") || 0;
            return numA - numB;
          });
          setChapters(merged);
          setLoadingChapters(false);
          if (effectiveHighlightId) {
            const lang = merged.find((c) => c.id === effectiveHighlightId)?.translatedLanguage;
            if (lang) setLangFilter(lang);
          }
        })
        .catch(() => setLoadingChapters(false));
    } else {
      // For non-manga, translate immediately
      if (book.description) {
        setTranslatingDesc(true);
        fetch(`${API_BASE}/books/translate?text=${encodeURIComponent(book.description)}`)
          .then((r) => r.json())
          .then((d: { translatedText: string; translated: boolean }) => {
            if (d.translated) setTranslatedDesc(d.translatedText);
            setTranslatingDesc(false);
          })
          .catch(() => setTranslatingDesc(false));
      }
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      if (!asPage) document.body.style.overflow = "";
    };
  }, []);

  // Fetch wallet balance and unlock status for user-uploaded chapters
  useEffect(() => {
    if (!user) return;
    const fetchWalletAndUnlocks = async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const [walletData, unlockData] = await Promise.all([
          getWalletBalance(token),
          getUnlocksForTitle(token, book.id),
        ]);
        setCoinBalance(walletData.balance);
        setUnlockedVersions(new Set(unlockData));
      } catch {
        // Wallet/unlock not available yet
      }
    };
    fetchWalletAndUnlocks();
  }, [user, book.id]);

  const handlePurchaseUnlock = useCallback(async (ch: MangaChapter) => {
    if (!user || !ch.versionId) return;
    setPurchasingId(ch.versionId);
    try {
      const token = await getIdToken();
      if (!token) return;
      const result = await purchaseUnlock(token, ch.versionId);
      if (result.unlocked || result.alreadyUnlocked) {
        setUnlockedVersions((prev) => new Set([...prev, ch.versionId!]));
        if (result.balance !== undefined) setCoinBalance(result.balance);
        // Auto-open the chapter after unlock
        addToHistory({ ...book, lastChapterId: ch.id, lastChapterNumber: ch.chapterNumber });
        setActiveChapter({ id: ch.id, chapterNumber: ch.chapterNumber, title: ch.title });
      }
    } catch (err: unknown) {
      const msg = errMessage(err);
      if (msg.includes("Insufficient") || msg.includes("ไม่พอ")) {
        setShowTopup(true);
      } else {
        alert(msg || "ไม่สามารถปลดล็อคได้");
      }
    } finally {
      setPurchasingId(null);
    }
  }, [user, book]);

  const handleTopup = useCallback(async () => {
    if (!user) return;
    setTopupLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const result = await topupCoins(token, topupAmount);
      setCoinBalance(result.balance);
      setShowTopup(false);
    } catch (err: unknown) {
      alert(errMessage(err) || "เติมเหรียญไม่สำเร็จ");
    } finally {
      setTopupLoading(false);
    }
  }, [user, topupAmount]);

  // Scroll-aware header in page mode
  useEffect(() => {
    if (!asPage) return;
    const onScroll = () => setHeaderScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [asPage]);

  // Scroll-aware header in mobile modal mode
  useEffect(() => {
    if (asPage || activeChapter !== null) return;
    const scroller = modalScrollRef.current;
    if (!scroller) return;

    const onScroll = () => setHeaderScrolled(scroller.scrollTop > 44);
    onScroll();

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [asPage, activeChapter, visible]);

  // Auto-scroll to chapters section (and highlighted chapter) when opened via "อ่านต่อ"
  useEffect(() => {
    if (scrollToChapters && !loadingChapters) {
      setTimeout(() => {
        chaptersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        // After the section scrolls into view, scroll the highlighted chapter into view in the list
        if (effectiveHighlightId) {
          setTimeout(() => {
            highlightChapterRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 400);
        }
      }, 150);
    }
  }, [scrollToChapters, loadingChapters, effectiveHighlightId]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    if (asPage) {
      setTimeout(onClose, 300);
      return;
    }
    const delay = window.innerWidth < 768 ? 300 : 400;
    setTimeout(() => {
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        window.history.back();
      }
      onClose();
    }, delay);
  };

  const displayThumbnail = selectedCover ?? resolvedThumbnail(book);
  const firstReadableChapter = chapters.find(
    (ch) => chapterAccess(ch, { unlockedVersions }).readable,
  );
  const hasReadableChapter = !!firstReadableChapter;

  // Prefer book.categories; fall back to genres from MangaDex detail; last resort "E-Book"
  const categories = book.categories.length
    ? book.categories
    : (detail?.genres?.length ? detail.genres : ["E-Book"]);

  // For manga: use authors/artists from API detail; for books: use book.authors
  const allAuthors = detail
    ? [...new Set([...detail.authors, ...detail.artists])]
    : book.authors;

  const content = (
    <div
      className={asPage ? `relative w-full bg-[#141414] transition-[opacity,transform] duration-300 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}` : `fixed inset-0 z-200 flex items-center justify-center md:p-4 md:backdrop-blur-sm transition-opacity duration-300 md:duration-400 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {/* Backdrop - modal mode only */}
      {!asPage && (
        <div
          className="absolute inset-0 bg-black md:bg-black/80"
          onClick={handleClose}
        />
      )}

      {/* Floating back-navigation header - page mode only */}
      {asPage && (
        <div className={`fixed top-0 left-0 right-0 z-20 flex h-14 items-center gap-3 px-4 transition-all duration-300 ${headerScrolled ? "border-b border-white/10 bg-[#141414]/80 backdrop-blur-md" : "border-b border-transparent bg-transparent"}`}>
          <button
            onClick={handleClose}
            title="กลับ"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <MarqueeTitle
            title={book.title}
            active={headerScrolled}
            className={`transition-opacity duration-300 ${headerScrolled ? "opacity-100" : "opacity-0"}`}
          />
        </div>
      )}

      {/* Modal container */}
      <div
        className={asPage ? "relative w-full" : `relative z-10 flex w-full h-full md:h-auto md:max-w-3xl md:max-h-[90vh] flex-col overflow-hidden md:rounded-3xl bg-[#141414] shadow-2xl transition-[transform,opacity] duration-300 md:duration-400 ease-out ${visible ? "translate-y-0 md:scale-100 md:opacity-100" : "translate-y-full md:translate-y-8 md:scale-90 md:opacity-0"}`}
      >
        {!asPage && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 md:hidden">
            <div
              className={`flex items-center gap-2.5 border-b px-3.5 pb-[0.55rem] pt-[calc(env(safe-area-inset-top)+0.6rem)] transition-[background-color,backdrop-filter,box-shadow,border-color,opacity] duration-300 ease-out ${
                headerScrolled
                  ? "border-white/8 bg-[#141414]/62 opacity-100 shadow-[0_6px_18px_rgba(0,0,0,0.16)] backdrop-blur-md"
                  : "border-transparent bg-transparent opacity-0 shadow-none backdrop-blur-none"
              }`}
            >
              <button
                onClick={handleClose}
                title="กลับ"
                className="pointer-events-auto flex h-[2.2rem] w-[2.2rem] items-center justify-center rounded-full border border-white/10 bg-black/20 text-white transition hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4.5 w-4.5">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              <MarqueeTitle title={book.title} active={headerScrolled} />
            </div>
          </div>
        )}

        <div
          ref={modalScrollRef}
          className={asPage ? "w-full pb-[calc(var(--mobile-nav-height)+1.5rem)]" : "flex-1 min-h-0 overflow-y-auto custom-scrollbar"}
        >
          <div ref={modalContentRef}>
            {/* Drag handle — mobile only */}
            {!asPage && (
              <div className="flex justify-center pt-3 pb-0.5 md:hidden">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
            )}

            {/* Close button — modal mode, desktop only */}
            {!asPage && (
              <button
                onClick={handleClose}
                title="ปิด"
                className={`absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-[opacity,transform] duration-300 hover:bg-white/20 md:opacity-100 md:pointer-events-auto ${headerScrolled ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Hero */}
            <div className="relative w-full overflow-hidden">
              {/* Blurred background */}
              <div className="absolute inset-0 overflow-hidden">
                <Image
                  src={displayThumbnail}
                  alt=""
                  fill
                  aria-hidden
                  sizes="768px"
                  className="scale-110 object-cover object-center blur-2xl brightness-[0.25] saturate-150"
                />
              </div>
              <div className="absolute inset-0 bg-linear-to-b from-[#141414]/60 via-transparent to-[#141414]" />

              {/* ── Mobile: stacked layout ─────────────────────────── */}
              <div className="relative z-10 md:hidden flex flex-col items-center px-5 pb-6 pt-9">
                {/* Cover */}
                <div className="relative aspect-2/3 w-36 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
                  <Image
                    src={displayThumbnail}
                    alt={book.title}
                    fill
                    className="object-cover object-center"
                    sizes="144px"
                    priority
                  />
                </div>

                {/* Title */}
                <div className="mt-3 w-full text-center">
                  <h2 className="text-xl font-black leading-tight text-white">{book.title}</h2>
                  {book.subtitle && (
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/60">{book.subtitle}</p>
                  )}
                </div>

                {/* Meta chips */}
                <div className="mt-2 flex flex-wrap justify-center items-center gap-1.5 text-xs">
                  {book.averageRating > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-green-400">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      {book.averageRating.toFixed(1)}
                    </span>
                  )}
                  {book.publishedDate && <span className="text-white/50">{book.publishedDate}</span>}
                  {categories.slice(0, 3).map((cat) => (
                    <span key={cat} className="rounded-full border border-white/20 px-2 py-0.5 text-white/70">{cat}</span>
                  ))}
                </div>

                {/* Actions — mobile */}
                <div className="mt-4 w-full space-y-2">
                  {/* Primary CTA: อ่านตอนแรก — full width */}
                  {isManga ? (
                    !loadingChapters && chapters.length === 0 ? (
                      <button disabled className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-white/20 py-3 text-sm font-bold text-white/40">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                          <path d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        ไม่มีตอนให้อ่าน
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (firstReadableChapter) {
                            addToHistory({ ...book, lastChapterId: firstReadableChapter.id, lastChapterNumber: firstReadableChapter.chapterNumber });
                            setActiveChapter({ id: firstReadableChapter.id, chapterNumber: firstReadableChapter.chapterNumber, title: firstReadableChapter.title });
                          }
                        }}
                        disabled={!hasReadableChapter || loadingChapters}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black transition active:bg-white/85 disabled:opacity-50"
                      >
                        {loadingChapters ? (
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 translate-x-px">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                        {loadingChapters ? "กำลังโหลด..." : hasReadableChapter ? `อ่านตอนที่ ${firstReadableChapter?.chapterNumber ?? "1"}` : "ไม่มีตอน"}
                      </button>
                    )
                  ) : (
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-black transition active:bg-white/85">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 translate-x-px">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      อ่านเลย
                    </button>
                  )}

                  {/* Secondary row: ดูตอนทั้งหมด + icon buttons */}
                  <div className="flex gap-2">
                    {isManga && (
                      <button
                        onClick={() => chaptersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        disabled={loadingChapters || chapters.length === 0}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/25 py-2.5 text-xs font-semibold text-white/80 transition active:bg-white/8 disabled:opacity-40"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
                          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                        ดูตอนทั้งหมด
                      </button>
                    )}
                    <button
                      title={favorited ? "อยู่ในรายการแล้ว" : "เพิ่มในรายการ"}
                      onClick={handleToggleFavorite}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                        favorited ? "border-white bg-white text-black" : "border-white/25 text-white/80"
                      }`}
                    >
                      {favorited ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      )}
                    </button>
                    <button
                      title={liked ? "เอาออก" : "ถูกใจ"}
                      onClick={handleToggleLiked}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                        liked ? "border-red-500 text-red-500" : "border-white/25 text-white/80"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Desktop: two-panel layout ──────────────────────── */}
              <div className="relative z-10 hidden md:flex gap-5 px-5 pb-6 pt-14">
                {/* Portrait thumbnail */}
                <div className="relative aspect-2/3 w-40 shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
                  <Image
                    src={displayThumbnail}
                    alt={book.title}
                    fill
                    className="object-cover object-center"
                    sizes="160px"
                    priority
                  />
                </div>

                {/* Info panel */}
                <div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
                  <div>
                    <h2 className="text-2xl font-black leading-tight text-white drop-shadow-lg">
                      {book.title}
                    </h2>
                    {book.subtitle && (
                      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/60">
                        {book.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {book.averageRating > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-green-400">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {book.averageRating.toFixed(1)}
                      </span>
                    )}
                    {book.publishedDate && <span className="text-white/50">{book.publishedDate}</span>}
                    {categories.slice(0, 3).map((cat) => (
                      <span key={cat} className="rounded-full border border-white/20 px-2 py-0.5 text-white/70">{cat}</span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isManga ? (
                      !loadingChapters && chapters.length === 0 ? (
                        <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-lg bg-white/20 px-5 py-2 text-sm font-bold text-white/40">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                            <path d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          ไม่มีตอนให้อ่าน
                        </button>
                      ) : (
                        <button
                          onClick={() => chaptersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                          disabled={loadingChapters}
                          className="flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/85 disabled:opacity-50"
                        >
                          {loadingChapters ? (
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 translate-x-px">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                          {loadingChapters ? "กำลังโหลด..." : "ดูตอนทั้งหมด"}
                        </button>
                      )
                    ) : (
                      <button className="flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/85">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 translate-x-px">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        อ่านเลย
                      </button>
                    )}
                    {isManga && (
                      <button
                        onClick={() => {
                          if (firstReadableChapter) {
                            addToHistory({ ...book, lastChapterId: firstReadableChapter.id, lastChapterNumber: firstReadableChapter.chapterNumber });
                            setActiveChapter({ id: firstReadableChapter.id, chapterNumber: firstReadableChapter.chapterNumber, title: firstReadableChapter.title });
                          }
                        }}
                        disabled={chapters.length === 0 || !hasReadableChapter}
                        className="flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        {loadingChapters ? "กำลังโหลด..." : hasReadableChapter ? `อ่านตอนที่ ${firstReadableChapter?.chapterNumber ?? "1"}` : "ไม่มีตอน"}
                      </button>
                    )}
                    <button
                      title={favorited ? "อยู่ในรายการแล้ว" : "เพิ่มในรายการ"}
                      onClick={handleToggleFavorite}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                        favorited ? "border-white bg-white text-black" : "border-white/40 text-white hover:border-white"
                      }`}
                    >
                      {favorited ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      )}
                    </button>
                    <button
                      title={liked ? "เอาออก" : "ถูกใจ"}
                      onClick={handleToggleLiked}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                        liked ? "border-red-500 text-red-500" : "border-white/40 text-white hover:border-white"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          {/* Description + side details */}
          <div className="flex gap-6 px-5 pb-2 pt-4">
            {/* Description */}
            <div className="flex-1 space-y-1.5">
              <p className="text-sm leading-relaxed text-white/75">
                {(translatedDesc && !showOriginalDesc) ? translatedDesc : (book.description || detail?.description || "ไม่มีคำอธิบายสำหรับเรื่องนี้")}
              </p>
              {translatingDesc && (
                <p className="text-[10px] text-white/30">กำลังแปล...</p>
              )}
              {translatedDesc && !translatingDesc && (
                <div className="flex items-center gap-2">
                  <GeminiBadge small />
                  <button
                    onClick={() => setShowOriginalDesc((v) => !v)}
                    className="text-[10px] text-white/40 underline underline-offset-2 hover:text-white/70 transition-colors"
                  >
                    {showOriginalDesc ? "แสดงคำแปล" : "ต้นฉบับ"}
                  </button>
                </div>
              )}

              {/* Mobile-only metadata row */}
              <div className="md:hidden pt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {allAuthors.length > 0 && (
                  <span className="text-white/40">
                    ผู้แต่ง <span className="text-white/65">{allAuthors.slice(0, 2).join(", ")}</span>
                  </span>
                )}
                {detail?.artists && detail.artists.length > 0 && (
                  <span className="text-white/40">
                    นักวาด <span className="text-white/65">{detail.artists.slice(0, 2).join(", ")}</span>
                  </span>
                )}
                {detail?.covers && (() => {
                  const vols = detail.covers.map((c) => parseFloat(c.volume ?? "")).filter((v) => !isNaN(v));
                  const last = vols.length > 0 ? Math.max(...vols) : null;
                  return last !== null ? (
                    <span className="text-white/40">จบเล่ม <span className="text-white/65">{last}</span></span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Side details — desktop only */}
            <div className="hidden w-40 shrink-0 space-y-3 text-xs md:block">
              {allAuthors.length > 0 && (
                <div>
                  <span className="text-white/40">ผู้แต่ง: </span>
                  <span className="text-white/85">{detail?.authors.join(", ") || book.authors.join(", ")}</span>
                </div>
              )}
              {detail?.artists && detail.artists.length > 0 && (
                <div>
                  <span className="text-white/40">นักวาด: </span>
                  <span className="text-white/85">{detail.artists.join(", ")}</span>
                </div>
              )}
              {categories.length > 0 && (
                <div>
                  <span className="text-white/40">หมวดหมู่: </span>
                  <span className="text-white/85">{categories.join(", ")}</span>
                </div>
              )}
              {book.ratingsCount > 0 && (
                <div>
                  <span className="text-white/40">รีวิว: </span>
                  <span className="text-white/85">{book.ratingsCount.toLocaleString()}</span>
                </div>
              )}
              {detail?.covers && (() => {
                const volumes = detail.covers
                  .map((c) => parseFloat(c.volume ?? ""))
                  .filter((v) => !isNaN(v));
                const lastVolume = volumes.length > 0 ? Math.max(...volumes) : null;
                return lastVolume !== null ? (
                  <div>
                    <span className="text-white/40">จำนวนเล่ม: </span>
                    <span className="text-white/85">{lastVolume} เล่ม</span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Volume covers gallery — MangaDex only */}
          {isManga && (
            <div className="px-6 pb-7">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/80">
                  {loadingDetail
                    ? "กำลังโหลดปกทุกเล่ม..."
                    : (() => {
                        const volumes = (detail?.covers ?? [])
                          .map((c) => parseFloat(c.volume ?? ""))
                          .filter((v) => !isNaN(v));
                        const lastVolume = volumes.length > 0 ? Math.max(...volumes) : null;
                        const coverCount = detail?.covers.length ?? 0;
                        return lastVolume !== null
                          ? `ปกทุกเล่ม (${coverCount} ปก · จบเล่ม ${lastVolume})`
                          : `ปกทุกเล่ม (${coverCount})`;
                      })()}
                </h3>
                {selectedCover && (
                  <button
                    onClick={() => setSelectedCover(null)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    ← กลับปกหลัก
                  </button>
                )}
              </div>

              {loadingDetail ? (
                <div  className="flex gap-3 overflow-x-auto pb-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-36 w-24 shrink-0 animate-pulse rounded-xl bg-white/10" />
                  ))}
                </div>
              ) : detail?.covers && detail.covers.length > 0 ? (
                <div
                  className="relative"
                  onMouseEnter={() => setIsHoveringCovers(true)}
                  onMouseLeave={() => setIsHoveringCovers(false)}
                >
                  {/* Left arrow */}
                  <button
                    onClick={() => scrollCovers("left")}
                    className={`absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20 backdrop-blur-sm transition-all duration-200 ${isHoveringCovers && coverCanScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    aria-label="เลื่อนซ้าย"
                  >
                    <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
                  </button>

                  {/* Right arrow */}
                  <button
                    onClick={() => scrollCovers("right")}
                    className={`absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20 backdrop-blur-sm transition-all duration-200 ${isHoveringCovers && coverCanScrollRight ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    aria-label="เลื่อนขวา"
                  >
                    <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                  </button>

                  <div
                    ref={coverRowRef}
                    className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar"
                    onScroll={updateCoverScroll}
                    onWheel={handleCoverRowWheel}
                  >
                  {detail.covers.map((cover, i) => {
                    const displayUrl = cover.localUrl
                      ? `${API_BASE}${cover.localUrl}`
                      : proxyImageUrl(cover.url);
                    return (
                    <button
                      key={i}
                      title={cover.volume ? `เล่ม ${cover.volume}` : `ปก ${i + 1}`}
                      onClick={() =>
                        setSelectedCover(selectedCover === displayUrl ? null : displayUrl)
                      }
                      className={`group relative h-36 w-24 shrink-0 overflow-hidden rounded-xl border transition-all duration-200 ${
                        selectedCover === displayUrl
                          ? "border-white ring-2 ring-white/50"
                          : "border-white/10 hover:border-white/40"
                      }`}
                    >
                      <Image
                        src={displayUrl}
                        alt={cover.volume ? `เล่ม ${cover.volume}` : `ปก ${i + 1}`}
                        fill
                        className="object-cover transition duration-200 group-hover:scale-105"
                        sizes="96px"
                      />
                      {cover.volume && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/75 py-0.5 text-center text-[10px] font-semibold text-white">
                          เล่ม {cover.volume}
                        </div>
                      )}
                      {/* Expand button */}
                      <div
                        onClick={(e) => { e.stopPropagation(); setLightboxSrc(displayUrl); }}
                        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white/90 opacity-100 backdrop-blur-sm transition-all duration-200 hover:bg-black/90 hover:text-white md:opacity-0 md:text-white/70 md:group-hover:opacity-100"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                      </div>
                    </button>
                    );
                  })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/40">ไม่พบข้อมูลปก</p>
              )}
            </div>
          )}

          {/* Chapters list — MangaDex only */}
          {isManga && (
            <div ref={chaptersRef} className="px-6 pb-7 scroll-mt-4">
              {/* Header row */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <h3 className="text-sm font-semibold text-white/80">
                    {loadingChapters
                      ? "กำลังโหลดตอน..."
                      : langFilter === "all"
                        ? `ตอนทั้งหมด (${chapters.length})`
                        : `ตอนทั้งหมด (${chapters.filter((c) => c.translatedLanguage === langFilter).length})`}
                  </h3>
                  {coinBalance !== null && (
                    <button
                      onClick={() => setShowTopup(true)}
                      className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/25"
                      title="เติมเหรียญ"
                    >
                      🪙 {coinBalance}
                    </button>
                  )}
                </div>

                {/* Language filter tabs */}
                {!loadingChapters && chapters.length > 0 && (() => {
                  const langs = ["all", ...Array.from(new Set(chapters.map((c) => c.translatedLanguage)))
                    .sort((a, b) => {
                      // Thai first, then others alphabetically
                      if (a === "th") return -1;
                      if (b === "th") return 1;
                      return a.localeCompare(b);
                    })];
                  const labelFor = (l: string) =>
                    l === "all" ? "ทั้งหมด" : l === "th" ? "ภาษาไทย" : l.toUpperCase();
                  return langs.length > 2 ? (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {langs.map((l) => (
                        <button
                          key={l}
                          onClick={() => setLangFilter(l)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                            langFilter === l
                              ? "bg-white/20 text-white"
                              : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                          }`}
                        >
                          {labelFor(l)}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>

              {loadingChapters ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-11 animate-pulse rounded-lg bg-white/10" />
                  ))}
                </div>
              ) : chapters.length > 0 ? (
                <div ref={chaptersListScrollRef} className={asPage ? "" : "max-h-[50vh] md:max-h-80 overflow-y-auto custom-scrollbar"}>
                  <div ref={chaptersContentRef} className="space-y-1.5">
                  {(() => {
                    const filtered = chapters.filter((ch) => langFilter === "all" || ch.translatedLanguage === langFilter);

                    // Group by chapterNumber only when showing all languages
                    // When a specific language is selected, show flat list
                    const shouldGroup = langFilter === "all";
                    const groupMap = new Map<string, MangaChapter[]>();
                    for (const ch of filtered) {
                      const key = shouldGroup ? (ch.chapterNumber ?? "?") : ch.id;
                      if (!groupMap.has(key)) groupMap.set(key, []);
                      groupMap.get(key)!.push(ch);
                    }

                    const ChapterRowInner = ({ ch, isTreeChild, isLast }: { ch: MangaChapter; isTreeChild: boolean; isLast?: boolean }) => {
                      const access = chapterAccess(ch, { unlockedVersions });
                      const readable = access.readable;
                      const coinLocked = access.coinLocked;
                      const unavailableLabel = readable ? null : access.unavailableLabel;
                      const isHighlighted = ch.id === effectiveHighlightId;
                      const isPurchasing = purchasingId === ch.versionId;
                      const row = (
                        <button
                          key={ch.id}
                          ref={isHighlighted ? highlightChapterRef : undefined}
                          onClick={() => {
                            if (coinLocked) {
                              handlePurchaseUnlock(ch);
                            } else if (readable) {
                              addToHistory({ ...book, lastChapterId: ch.id, lastChapterNumber: ch.chapterNumber });
                              setActiveChapter({ id: ch.id, chapterNumber: ch.chapterNumber, title: ch.title });
                            }
                          }}
                          disabled={!readable && !coinLocked}
                          className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition ${
                            isHighlighted
                              ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/30 cursor-pointer"
                              : coinLocked
                              ? "border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5 cursor-pointer"
                              : readable
                              ? "border-white/10 hover:border-white/25 hover:bg-white/8 cursor-pointer"
                              : "border-white/5 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          {!isTreeChild && (
                            <span className="w-20 shrink-0 text-xs font-semibold text-white">
                              ตอนที่ {ch.chapterNumber ?? "?"}
                            </span>
                          )}
                          {ch.title ? (
                            <span className="flex-1 truncate text-xs text-white/55">{ch.title}</span>
                          ) : (
                            <span className="flex-1" />
                          )}
                          {isHighlighted && (
                            <span className="shrink-0 rounded bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                              อ่านค้างไว้
                            </span>
                          )}
                          {ch.source === "user" && (
                            <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-300" title={ch.translatorName ? `แปลโดย ${ch.translatorName}` : "แปลโดยผู้ใช้"}>
                              {ch.translatorName ? ch.translatorName : "ผู้ใช้แปล"}
                            </span>
                          )}
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              ch.translatedLanguage === "th"
                                ? "bg-blue-500/20 text-blue-300"
                                : "bg-white/8 text-white/40"
                            }`}
                          >
                            {ch.translatedLanguage === "th" ? "ภาษาไทย" : ch.translatedLanguage.toUpperCase()}
                          </span>
                          {coinLocked ? (
                            isPurchasing ? (
                              <span className="shrink-0 flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                <div className="h-3 w-3 animate-spin rounded-full border border-amber-300/30 border-t-amber-300" />
                                ปลดล็อค...
                              </span>
                            ) : (
                              <span className="shrink-0 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                🪙 {ch.priceCoins} ปลดล็อค
                              </span>
                            )
                          ) : readable ? (
                            <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                              {ch.pageCount > 0 ? `${ch.pageCount} หน้า` : "พร้อมอ่าน"}
                            </span>
                          ) : (
                            <span className="shrink-0 rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-white/30">
                              {unavailableLabel}
                            </span>
                          )}
                          {readable && (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-white/30">
                              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                            </svg>
                          )}
                        </button>
                      );
                      if (!isTreeChild) return row;
                      return (
                        <div key={ch.id} className="relative flex gap-0 pb-1">
                          <div className="relative w-6 shrink-0 self-stretch">
                            <div
                              className="absolute left-2.5 top-0 w-px bg-white/10"
                              style={{ bottom: isLast ? "50%" : "0" }}
                            />
                            <div className="absolute left-2.5 top-4 flex items-center">
                              <div className="h-px w-3 bg-white/10" />
                              <div className="h-1 w-1 rounded-full bg-white/20" />
                            </div>
                          </div>
                          <div className="flex-1">{row}</div>
                        </div>
                      );
                    };

                    return Array.from(groupMap.entries()).map(([chNum, grp]) => {
                      if (grp.length === 1) {
                        return <ChapterRowInner key={grp[0].id} ch={grp[0]} isTreeChild={false} />;
                      }
                      const groupKey = chNum;
                      const isOpen = expandedGroups.has(groupKey);
                      const groupHasHighlight = grp.some((c) => c.id === effectiveHighlightId);
                      return (
                        <div key={groupKey}>
                          {/* Group header */}
                          <button
                            onClick={() => setExpandedGroups((prev) => {
                              const next = new Set(prev);
                              if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
                              return next;
                            })}
                            className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition ${
                              groupHasHighlight && !isOpen
                                ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/30 hover:border-blue-400/60 hover:bg-blue-500/15"
                                : "border-white/10 hover:border-white/25 hover:bg-white/8"
                            }`}
                          >
                            <span className="w-20 shrink-0 text-xs font-semibold text-white">
                              ตอนที่ {chNum}
                            </span>
                            <span className="flex-1 text-xs text-white/40">{grp.length} เวอร์ชัน</span>
                            {groupHasHighlight && !isOpen && (
                              <span className="shrink-0 rounded bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                                อ่านค้างไว้
                              </span>
                            )}
                            <div className="flex gap-1">
                              {Array.from(new Set(grp.map((c) => c.translatedLanguage))).map((lang) => (
                                <span key={lang} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${lang === "th" ? "bg-blue-500/20 text-blue-300" : "bg-white/8 text-white/40"}`}>
                                  {lang === "th" ? "ภาษาไทย" : lang.toUpperCase()}
                                </span>
                              ))}
                            </div>
                            <svg
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`h-3.5 w-3.5 shrink-0 text-white/30 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          {/* Expanded children — grid slide animation */}
                          <div
                            className="grid transition-all duration-300 ease-in-out"
                            style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                          >
                            <div className="overflow-hidden">
                              <div className="ml-3 mt-1">
                                {grp.map((ch, i) => (
                                  <ChapterRowInner key={ch.id} ch={ch} isTreeChild isLast={i === grp.length - 1} />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/40">ไม่พบตอนที่แปลแล้ว</p>
              )}
            </div>
          )}

          {/* Manga-specific discussion threads (Phase 2 Community) */}
          {isManga && (
            <MangaDiscussion mangaId={book.id} title={book.title} cover={resolvedThumbnail(book)} />
          )}
        </div>
      </div>
    </div>

      {/* Topup Modal */}
      {showTopup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowTopup(false)}>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#1a1a1a] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-center text-base font-bold text-white">เติมเหรียญ (ทดสอบ)</h3>
            <p className="mb-4 text-center text-xs text-white/40">เหรียญปัจจุบัน: 🪙 {coinBalance ?? 0}</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[50, 100, 200, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopupAmount(amt)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    topupAmount === amt
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  🪙 {amt}
                </button>
              ))}
            </div>
            <button
              onClick={handleTopup}
              disabled={topupLoading}
              className="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white transition hover:bg-amber-500 disabled:opacity-50"
            >
              {topupLoading ? "กำลังเติม..." : `เติม ${topupAmount} เหรียญ`}
            </button>
            <button
              onClick={() => setShowTopup(false)}
              className="mt-2 w-full rounded-xl border border-white/10 py-2 text-xs font-semibold text-white/50 transition hover:bg-white/5"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (!mounted) return null;

  if (asPage) {
    return (
      <>
        {content}
        {lightboxSrc && (
          <CoverLightbox src={lightboxSrc} alt={book.title} onClose={() => setLightboxSrc(null)} />
        )}
        {activeChapter && (
          <MangaReader
            chapterId={activeChapter.id}
            chapterNumber={activeChapter.chapterNumber}
            chapterTitle={activeChapter.title}
            mangaTitle={book.title}
            mangaId={book.id}
            onClose={() => setActiveChapter(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {createPortal(content, document.body)}
      {lightboxSrc && (
        <CoverLightbox src={lightboxSrc} alt={book.title} onClose={() => setLightboxSrc(null)} />
      )}
      {activeChapter && (
        <MangaReader
          chapterId={activeChapter.id}
          chapterNumber={activeChapter.chapterNumber}
          chapterTitle={activeChapter.title}
          mangaTitle={book.title}
          mangaId={book.id}
          onClose={() => setActiveChapter(null)}
        />
      )}
    </>
  );
}
