"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CoverLightbox from "./CoverLightbox";
import GeminiBadge from "./GeminiBadge";
import MangaReader from "./MangaReader";
import { addToHistory, getHistory } from "../lib/readingHistory";
import { useBookActions } from "../hooks/useBookActions";
import { useLocalLenis } from "../hooks/useLocalLenis";
import { resolvedThumbnail, proxyImageUrl } from "../lib/imgUrl";

type LandingBook = {
  id: string;
  title: string;
  subtitle: string;
  authors: string[];
  description: string;
  thumbnail: string;
  thumbnailLocal?: string;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
};

type MangaCover = {
  volume: string | null;
  url: string;
  /** Local /img-cache/… path returned when backend IMAGE_CACHE_ENABLED=true */
  localUrl?: string;
};

type MangaDetail = {
  id: string;
  authors: string[];
  artists: string[];
  covers: MangaCover[];
  genres?: string[];
  description?: string;
};

type MangaChapter = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
  translatedLanguage: string;
  uploadedAt: string;
  pageCount: number;
  /** forceLocal mode: true when this chapter has local cache for reader */
  readerAvailable?: boolean;
  /** True if returned from stale cache because the upstream API went offline */
  isOfflineFallback?: boolean;
  /** 'mangadex' (default) or 'user' for user-uploaded translations */
  source?: "mangadex" | "user";
  /** Translator name for user-uploaded versions */
  translatorName?: string | null;
};

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

export default function BookDetailModal({ book, onClose, scrollToChapters = false, highlightChapterId, asPage = false }: Props) {
  const router = useRouter();
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
  const [forceLocalMode, setForceLocalMode] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const coverRowRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<HTMLDivElement>(null); // For scrolling to start
  const highlightChapterRef = useRef<HTMLButtonElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const chaptersListScrollRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const historyPushedRef = useRef(false);
  
  const [isHoveringCovers, setIsHoveringCovers] = useState(false);
  const [coverCanScrollLeft, setCoverCanScrollLeft] = useState(false);
  const [coverCanScrollRight, setCoverCanScrollRight] = useState(true);

  // Apply custom local Lenis smooth scrolling
  useLocalLenis(modalScrollRef, "vertical", !asPage && visible && activeChapter === null);
  useLocalLenis(chaptersListScrollRef, "vertical", !asPage && visible && activeChapter === null && chapters.length > 0);

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
      setForceLocalMode(forceLocal);
      const qs = forceLocal ? "?forceLocal=true" : "";

      fetch(`${API_BASE}/books/manga/${book.id}${qs}`)
        .then((r) => r.json())
        .then((d: MangaDetail) => {
          setDetail(d);
          setLoadingDetail(false);
          
          // Auto-translate description if non-Thai (using detail.description if book.description is empty)
          const descToTranslate = book.description || d.description;
          if (descToTranslate) {
            setTranslatingDesc(true);
            fetch(`${API_BASE}/books/translate?text=${encodeURIComponent(descToTranslate)}`)
              .then((r) => r.json())
              .then((trans: { translatedText: string; translated: boolean }) => {
                if (trans.translated) setTranslatedDesc(trans.translatedText);
                setTranslatingDesc(false);
              })
              .catch(() => setTranslatingDesc(false));
          }
        })
        .catch(() => setLoadingDetail(false));

      fetch(`${API_BASE}/books/manga/${book.id}/chapters${qs}`)
        .then((r) => r.json())
        .then((mangaDexChapters: MangaChapter[]) => {
          // Tag MangaDex chapters with source
          const tagged = mangaDexChapters.map((ch) => ({ ...ch, source: "mangadex" as const }));

          // Also fetch user-uploaded versions for this title
          fetch(`${API_BASE}/versions/title/${book.id}`)
            .then((r) => r.ok ? r.json() : [])
            .then((versions: any[]) => {
              const userChapters: MangaChapter[] = (versions ?? []).map((v: any) => ({
                id: `ver:${v.versionId}`,
                chapterNumber: v.chapterNumber || null,
                title: v.chapterTitle || null,
                translatedLanguage: v.language || "th",
                uploadedAt: v.createdAt || "",
                pageCount: v.pages?.length ?? 0,
                readerAvailable: true,
                source: "user" as const,
                translatorName: v.translatorName ?? null,
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
            .catch(() => {
              setChapters(tagged);
              setLoadingChapters(false);
              if (effectiveHighlightId) {
                const lang = tagged.find((c) => c.id === effectiveHighlightId)?.translatedLanguage;
                if (lang) setLangFilter(lang);
              }
            });
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
  const chapterNeedsBackup = (ch: MangaChapter) => ch.isOfflineFallback === true;
  const isChapterReadable = (ch: MangaChapter) => {
    if (chapterNeedsBackup(ch)) {
      return ch.readerAvailable === true;
    }
    return ch.pageCount > 0;
  };

  const getUnavailableChapterLabel = (ch: MangaChapter) => {
    if (chapterNeedsBackup(ch) && ch.readerAvailable !== true) {
      return "ไม่ได้สำรอง";
    }
    return "ล็อค";
  };

  const firstReadableChapter = chapters.find((ch) => isChapterReadable(ch));
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
          <span className={`flex-1 truncate text-sm font-semibold text-white transition-opacity duration-300 ${headerScrolled ? "opacity-100" : "opacity-0"}`}>{book.title}</span>
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
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-[0.01em] text-white/98">{book.title}</p>
              </div>
            </div>
          </div>
        )}

        <div
          ref={modalScrollRef}
          className={asPage ? "w-full pb-[calc(var(--mobile-nav-height)+1.5rem)]" : "flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]"}
        >
          {/* Close button - modal mode only */}
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

          {/* Hero — two-panel card layout, matching HeroCarousel style */}
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

            {/* Two-panel card */}
            <div className="relative z-10 flex gap-5 px-5 pb-6 pt-14">
              {/* Portrait thumbnail */}
              <div className="relative aspect-2/3 w-32 shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 md:w-40">
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
                {/* Title */}
                <div>
                  <h2 className="text-xl font-black leading-tight text-white drop-shadow-lg md:text-2xl">
                    {book.title}
                  </h2>
                  {book.subtitle && (
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/60">
                      {book.subtitle}
                    </p>
                  )}
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {book.averageRating > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-green-400">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      {book.averageRating.toFixed(1)}
                    </span>
                  )}
                  {book.publishedDate && (
                    <span className="text-white/50">{book.publishedDate}</span>
                  )}
                  {categories.slice(0, 3).map((cat) => (
                    <span key={cat} className="rounded-full border border-white/20 px-2 py-0.5 text-white/70">
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {isManga ? (
                    !loadingChapters && chapters.length === 0 ? (
                      <button
                        disabled
                        className="flex cursor-not-allowed items-center gap-2 rounded-lg bg-white/20 px-5 py-2 text-sm font-bold text-white/40"
                      >
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
                      {loadingChapters
                        ? "กำลังโหลด..."
                        : hasReadableChapter
                          ? `อ่านตอนที่ ${firstReadableChapter?.chapterNumber ?? "1"}`
                          : "ไม่มีตอน"}
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
            </div>

            {/* Side details */}
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
                    className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]"
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
                <h3 className="text-sm font-semibold text-white/80 shrink-0">
                  {loadingChapters
                    ? "กำลังโหลดตอน..."
                    : langFilter === "all"
                      ? `ตอนทั้งหมด (${chapters.length})`
                      : `ตอนทั้งหมด (${chapters.filter((c) => c.translatedLanguage === langFilter).length})`}
                </h3>

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
                <div ref={chaptersListScrollRef} className={`space-y-1.5 ${asPage ? "" : "max-h-72 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]"}`}>
                  {chapters
                    .filter((ch) => langFilter === "all" || ch.translatedLanguage === langFilter)
                    .map((ch) => {
                    const readable = isChapterReadable(ch);
                    const unavailableLabel = readable ? null : getUnavailableChapterLabel(ch);
                    const isHighlighted = ch.id === effectiveHighlightId;
                    return (
                      <button
                        key={ch.id}
                        ref={isHighlighted ? highlightChapterRef : undefined}
                        onClick={() => { if (readable) { addToHistory({ ...book, lastChapterId: ch.id, lastChapterNumber: ch.chapterNumber }); setActiveChapter({ id: ch.id, chapterNumber: ch.chapterNumber, title: ch.title }); } }}
                        disabled={!readable}
                        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition ${
                          isHighlighted
                            ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/30 cursor-pointer"
                            : readable
                            ? "border-white/10 hover:border-white/25 hover:bg-white/8 cursor-pointer"
                            : "border-white/5 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <span className="w-20 shrink-0 text-xs font-semibold text-white">
                          ตอนที่ {ch.chapterNumber ?? "?"}
                        </span>
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
                        {readable ? (
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
                  })}
                </div>
              ) : (
                <p className="text-xs text-white/40">ไม่พบตอนที่แปลแล้ว</p>
              )}
            </div>
          )}
        </div>
      </div>
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
