"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getHistory, HISTORY_EVENT, type HistoryBook, patchThumbnailLocal } from "../lib/readingHistory";
import BookDetailModal from "./BookDetailModal";
import GeminiBadge from "./GeminiBadge";
import MangaReader from "./MangaReader";
import { useBookActions } from "../hooks/useBookActions";
import { resolvedThumbnail } from "../lib/imgUrl";

const API_BASE = "/api/proxy";

const truncate = (text: string, length: number) => {
  if (!text) return "ค้นพบหนังสือใหม่ที่น่าอ่านในทุกวัน";
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "เมื่อกี้";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  return `${Math.floor(days / 7)} สัปดาห์ที่แล้ว`;
}

function HistoryCard({
  book,
  isNew,
}: {
  book: HistoryBook;
  isNew: boolean;
}) {
  const [isLandscape, setIsLandscape] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [scrollToChapters, setScrollToChapters] = useState(false);
  const [showReader, setShowReader] = useState(false);
  // true = panel expands to the right, false = to the left
  const [expandRight, setExpandRight] = useState(true);
  const articleRef = useRef<HTMLElement>(null);

  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [translatingDesc, setTranslatingDesc] = useState(false);
  const [showOriginalDesc, setShowOriginalDesc] = useState(false);
  const translateFetched = useRef(false);
  const { favorited, liked, handleToggleFavorite, handleToggleLiked } = useBookActions(book);

  const openContinue = () => {
    if (book.lastChapterId) { setShowReader(true); }
    else { setScrollToChapters(true); setShowModal(true); }
  };
  const openDetail = () => { setScrollToChapters(false); setShowModal(true); };

  useEffect(() => {
    const check = () => {
      if (!articleRef.current) return;
      const { right } = articleRef.current.getBoundingClientRect();
      setExpandRight(right + 224 <= window.innerWidth);
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleHover = () => {
    // Re-check expand direction on every hover so scroll position is accounted for
    if (articleRef.current) {
      const { right } = articleRef.current.getBoundingClientRect();
      setExpandRight(right + 224 <= window.innerWidth);
    }
    if (translateFetched.current || !book.description) return;
    translateFetched.current = true;
    setTranslatingDesc(true);
    fetch(`${API_BASE}/books/translate?text=${encodeURIComponent(book.description)}`)
      .then((r) => r.json())
      .then((d: { translatedText: string; translated: boolean }) => {
        if (d.translated) setTranslatedDesc(d.translatedText);
        setTranslatingDesc(false);
      })
      .catch(() => setTranslatingDesc(false));
  };

  return (
    <article
      ref={articleRef}
      onMouseEnter={handleHover}
      className={`group relative w-[9.5rem] min-w-[9.5rem] shrink-0 rounded-2xl border border-white/10 bg-white/5 md:backdrop-blur-xl md:w-[13.75rem] md:min-w-[13.75rem] md:transition md:duration-300 md:hover:z-30 md:hover:scale-[1.08] md:hover:border-white/20 ${expandRight ? "origin-left" : "origin-right"} ${isNew ? "cr-card-enter" : ""}`}
    >
      {/* Cover */}
      <div
        onClick={openDetail}
        className={`relative w-full cursor-pointer overflow-hidden rounded-2xl transition-all duration-300 ${
          expandRight ? "group-hover:rounded-r-none" : "group-hover:rounded-l-none"
        } ${isLandscape ? "aspect-4/3" : "aspect-2/3"}`}
      >
        <Image
          src={resolvedThumbnail(book)}
          alt={book.title}
          fill
          onLoad={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.naturalWidth > img.naturalHeight) setIsLandscape(true);
          }}
          onError={(e) => {
            if (book.thumbnailLocal && book.thumbnail) {
              // Clear the stale path from localStorage so future loads skip it
              patchThumbnailLocal(book.id);
              (e.currentTarget as HTMLImageElement).src =
                `/api/img-proxy?url=${encodeURIComponent(book.thumbnail)}`;
            }
          }}
          className={`transition duration-300 group-hover:scale-105 ${
            isLandscape ? "object-contain" : "object-cover"
          }`}
          sizes="220px"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-100 transition duration-300 md:opacity-0 md:group-hover:opacity-100" />

        {/* "อ่านต่อ" badge */}
        <div
          onClick={(e) => { e.stopPropagation(); openContinue(); }}
          className="absolute bottom-2 left-2 right-2 opacity-100 transition duration-300 md:opacity-0 md:group-hover:opacity-100"
        >
          <div className="flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0 translate-x-px text-black">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="text-[11px] font-bold text-black">อ่านต่อ</span>
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div
        className={`pointer-events-none absolute top-0 z-20 hidden h-full w-56 flex-col justify-between bg-black/95 p-4 opacity-0 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all duration-300 md:flex md:group-hover:pointer-events-auto md:group-hover:opacity-100 ${
          expandRight
            ? "left-full -translate-x-2 rounded-r-2xl group-hover:translate-x-0"
            : "right-full translate-x-2 rounded-l-2xl group-hover:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={openContinue}
            title="อ่านต่อ"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/80"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 translate-x-px">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <button
            title={favorited ? "นำออกจากรายการ" : "เพิ่มในรายการ"}
            onClick={handleToggleFavorite}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              favorited
                ? "border-green-400/60 bg-green-500/20 text-green-400"
                : "border-white/30 text-white hover:border-white/60"
            }`}
          >
            {favorited ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </button>
          <button
            title={liked ? "เลิกถูกใจ" : "ถูกใจ"}
            onClick={handleToggleLiked}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              liked
                ? "border-red-400/60 bg-red-500/20 text-red-400"
                : "border-white/30 text-white hover:border-white/60"
            }`}
          >
            <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white">{book.title}</h3>
          <div className="space-y-1">
            <p className="line-clamp-3 text-xs leading-relaxed text-white/65">
              {translatedDesc && !showOriginalDesc ? truncate(translatedDesc, 120) : truncate(book.description, 120)}
            </p>
            {translatingDesc && <p className="text-[9px] text-white/30">กำลังแปล...</p>}
            {translatedDesc && !translatingDesc && (
              <div className="flex items-center gap-2">
                <GeminiBadge small />
                <button
                  onClick={() => setShowOriginalDesc((v) => !v)}
                  className="text-[9px] text-white/40 underline underline-offset-2 hover:text-white/70 transition-colors"
                >
                  {showOriginalDesc ? "แสดงคำแปล" : "ต้นฉบับ"}
                </button>
              </div>
            )}
          </div>
          <p className="text-[11px] text-white/35">{relativeTime(book.lastReadAt)}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(book.categories.length ? book.categories : ["E-Book"])
            .slice(0, 3)
            .map((cat) => (
              <span
                key={cat}
                className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/55"
              >
                {cat}
              </span>
            ))}
        </div>

        <button
          onClick={openDetail}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 py-1.5 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white/90"
        >
          ดูรายละเอียด
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {showModal && (
        <BookDetailModal
          book={book}
          onClose={() => setShowModal(false)}
          scrollToChapters={scrollToChapters}
          highlightChapterId={book.lastChapterId}
        />
      )}
      {showReader && book.lastChapterId && (
        <MangaReader
          chapterId={book.lastChapterId}
          chapterNumber={book.lastChapterNumber ?? null}
          chapterTitle={null}
          mangaTitle={book.title}
          mangaId={book.id}
          onClose={() => setShowReader(false)}
        />
      )}
    </article>
  );
}

export default function ContinueReadingRow() {
  const [history, setHistory] = useState<HistoryBook[]>([]);
  const [newBookId, setNewBookId] = useState<string | null>(null);
  // sectionVisible drives the height animation
  // Always start false so SSR and client first-render agree (hydration safety)
  const [sectionVisible, setSectionVisible] = useState(false);
  // revealKey increments each time section goes 01, re-triggering cr-section-reveal
  const [revealKey, setRevealKey] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [hoveredArrow, setHoveredArrow] = useState<"left" | "right" | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const prevFirstIdRef = useRef<string | null>(null);
  // Tracked so the new-card animation timer never fires setState after unmount (#139)
  const newCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (newCardTimerRef.current) clearTimeout(newCardTimerRef.current);
  }, []);

  const refresh = () => {
    const next = getHistory();
    const prevCount = prevCountRef.current;
    const prevFirstId = prevFirstIdRef.current;

    // Section reveals for first time (0  1+)
    if (prevCount === 0 && next.length > 0) {
      setSectionVisible(true);
      setRevealKey((k) => k + 1);
    }
    // Section collapses (1+  0)
    if (next.length === 0) {
      setSectionVisible(false);
    }

    // New card at front
    if (next.length > 0 && next[0].id !== prevFirstId) {
      setNewBookId(next[0].id);
      // Clear after animation completes — via ref so unmount cancels it
      if (newCardTimerRef.current) clearTimeout(newCardTimerRef.current);
      newCardTimerRef.current = setTimeout(() => setNewBookId(null), 600);
    }

    prevCountRef.current = next.length;
    prevFirstIdRef.current = next[0]?.id ?? null;
    setHistory(next);
  };

  useEffect(() => {
    const initial = getHistory();
    prevCountRef.current = initial.length;
    prevFirstIdRef.current = initial[0]?.id ?? null;
    queueMicrotask(() => {
      setHistory(initial);
      // Now safe to reflect localStorage  we are past hydration
      if (initial.length > 0) setSectionVisible(true);
    });
    window.addEventListener(HISTORY_EVENT, refresh);
    return () => window.removeEventListener(HISTORY_EVENT, refresh);
  }, []);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
  }, [history]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    // Grid trick: animates height smoothly without knowing actual height
    <div
      className="continue-reading-shell"
      data-open={sectionVisible}
    >
      <div className="overflow-hidden">
        {/* Padding bottom so cards do not clip during collapse */}
        <div
          key={revealKey}
          className={`pb-2 ${sectionVisible && revealKey > 0 ? "cr-section-reveal" : ""}`}
        >
          <section
            id="continue-reading"
            className="relative"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
              <h2 className="text-lg font-bold text-white sm:text-xl md:text-2xl">
                อ่านต่อ
                <span className="ml-3 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-normal text-blue-300">
                  {history.length} เรื่อง
                </span>
              </h2>
              <Link
                href="/mylist?tab=history"
                className="flex items-center gap-1 text-xs text-white/40 transition hover:text-white/80"
              >
                ดูเพิ่มเติม
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>

            <div className="relative">
              {/* Left arrow */}
              <button
                onClick={() => scroll("left")}
                onMouseEnter={() => setHoveredArrow("left")}
                onMouseLeave={() => setHoveredArrow(null)}
                className={`absolute left-2 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 md:flex ${
                  hoveredArrow === "left" ? "h-11 w-11" : "h-9 w-9"
                } ${isHovering && canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"}`}
                aria-label="เลื่อนซ้าย"
              >
                <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>

              {/* Right arrow */}
              <button
                onClick={() => scroll("right")}
                onMouseEnter={() => setHoveredArrow("right")}
                onMouseLeave={() => setHoveredArrow(null)}
                className={`absolute right-2 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 md:flex ${
                  hoveredArrow === "right" ? "h-11 w-11" : "h-9 w-9"
                } ${isHovering && canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"}`}
                aria-label="เลื่อนขวา"
              >
                <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>

              {/* Row */}
              <div
                ref={scrollRef}
                onScroll={updateScrollState}
                className="flex gap-3 overflow-x-auto overflow-y-visible pb-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4"
              >
                {history.map((book) => (
                  <HistoryCard
                    key={book.id}
                    book={book}
                    isNew={book.id === newBookId}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}