"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import BookDetailModal from "./BookDetailModal";
import CoverLightbox from "./CoverLightbox";
import GeminiBadge from "./GeminiBadge";
import MangaReader from "./MangaReader";
import { useBookActions } from "../hooks/useBookActions";
import { resolvedThumbnail } from "../lib/imgUrl";
import { getHistory } from "../lib/readingHistory";

const API_BASE = "/api/proxy";

type LandingBook = {
  id: string;
  title: string;
  subtitle: string;
  authors: string[];
  description: string;
  thumbnail: string;
  thumbnailLocal?: string;
  /** false = forceLocal mode and file not yet cached */
  thumbnailCached?: boolean;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
};

type BookRowProps = {
  rowId: string;
  rowTitle: string;
  items: LandingBook[];
  seeMoreHref?: string;
};

const truncate = (text: string, length: number) => {
  if (!text) return "ค้นพบหนังสือใหม่ที่น่าอ่านในทุกวัน";
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

function BookCard({
  book,
  rowId,
}: {
  book: LandingBook;
  rowId: string;
}) {
  const [isLandscape, setIsLandscape] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [translatingDesc, setTranslatingDesc] = useState(false);
  const [showOriginalDesc, setShowOriginalDesc] = useState(false);
  const translateFetched = useRef(false);
  const articleRef = useRef<HTMLElement>(null);
  // true = info panel expands to the right — recalculated on each hover
  const [expandRight, setExpandRight] = useState(true);
  const { favorited, liked, handleToggleFavorite, handleToggleLiked } = useBookActions(book);

  // Read history only after mount to avoid SSR/client hydration mismatch
  const [lastChapterId, setLastChapterId] = useState<string | undefined>(undefined);
  const [lastChapterNumber, setLastChapterNumber] = useState<string | null | undefined>(undefined);
  const [showReader, setShowReader] = useState(false);

  useEffect(() => {
    const entry = getHistory().find((h) => h.id === book.id);
    queueMicrotask(() => {
      setLastChapterId(entry?.lastChapterId);
      setLastChapterNumber(entry?.lastChapterNumber);
    });
  }, [book.id]);

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
      key={`${rowId}-${book.id}`}
      onMouseEnter={handleHover}
      className={`group relative w-[9.5rem] min-w-[9.5rem] shrink-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl md:w-[13.75rem] md:min-w-[13.75rem] md:transition md:duration-300 md:hover:z-30 md:hover:scale-[1.08] md:hover:border-white/20 ${expandRight ? "origin-left" : "origin-right"}`}
    >
      {/* Cover image */}
      <div
        onClick={() => setShowModal(true)}
        className={`relative w-full cursor-pointer overflow-hidden rounded-2xl transition-all duration-300 ${
          expandRight ? "group-hover:rounded-r-none" : "group-hover:rounded-l-none"
        } ${isLandscape ? "aspect-4/3" : "aspect-2/3"}`}
      >
        {book.thumbnailCached === false ? (
          <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-1 bg-white/5 text-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
              <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
              <path d="M16 3v4M8 3v4" />
            </svg>
            <span className="text-[9px] font-medium">ไม่มีใน Cache</span>
          </div>
        ) : (
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
                (e.currentTarget as HTMLImageElement).src =
                  `/api/img-proxy?url=${encodeURIComponent(book.thumbnail)}`;
              }
            }}
            className={`transition duration-300 group-hover:scale-105 ${
              isLandscape ? "object-contain" : "object-cover"
            }`}
            sizes="220px"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        {/* Expand cover button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowCover(true); }}
          title="ดูหน้าปกขนาดใหญ่"
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-100 backdrop-blur-sm transition-all duration-200 hover:bg-black/80 hover:text-white md:opacity-0 md:group-hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>

      {/* Info panel — expands right unless near the right edge */}
      <div
        className={`pointer-events-none absolute top-0 z-20 hidden h-full w-56 flex-col justify-between bg-black/95 p-4 opacity-0 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all duration-300 md:flex md:group-hover:pointer-events-auto md:group-hover:opacity-100 ${
          expandRight
            ? "left-full -translate-x-2 rounded-r-2xl group-hover:translate-x-0"
            : "right-full translate-x-2 rounded-l-2xl group-hover:translate-x-0"
        }`}
      >
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            title={lastChapterId ? "อ่านต่อ" : "อ่าน"}
            onClick={() => lastChapterId ? setShowReader(true) : setShowModal(true)}
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

        {/* Title & description */}
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
        </div>

        {/* Category tags */}
        <div className="flex flex-wrap gap-1.5">
          {(book.categories.length ? book.categories : ["E-Book", "Popular"])
            .slice(0, 3)
            .map((category) => (
              <span
                key={`${book.id}-${category}`}
                className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/55"
              >
                {category}
              </span>
            ))}
        </div>

        {/* Expand to detail */}
        <button
          title="ดูรายละเอียด"
          onClick={() => setShowModal(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 py-1.5 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white/90"
        >
          ดูรายละเอียด
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {showModal && (
        <BookDetailModal book={book} onClose={() => setShowModal(false)} />
      )}
      {showCover && (
        <CoverLightbox
          src={resolvedThumbnail(book)}
          alt={book.title}
          onClose={() => setShowCover(false)}
        />
      )}
      {showReader && lastChapterId && (
        <MangaReader
          chapterId={lastChapterId}
          chapterNumber={lastChapterNumber ?? null}
          chapterTitle={null}
          mangaTitle={book.title}
          mangaId={book.id}
          onClose={() => setShowReader(false)}
        />
      )}
    </article>
  );
}

export default function BookRow({ rowId, rowTitle, items, seeMoreHref }: BookRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHoveringRow, setIsHoveringRow] = useState(false);
  const [hoveredArrow, setHoveredArrow] = useState<"left" | "right" | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
  }, [items]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section
      className="relative"
      onMouseEnter={() => setIsHoveringRow(true)}
      onMouseLeave={() => setIsHoveringRow(false)}
    >
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <h2 className="text-lg font-bold text-white sm:text-xl md:text-2xl">{rowTitle}</h2>
        {seeMoreHref && (
          <Link
            href={seeMoreHref}
            className="flex items-center gap-1 text-xs text-white/40 transition hover:text-white/80"
          >
            ดูเพิ่มเติม
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </Link>
        )}
      </div>

      {/* Scroll area wrapper — arrows are relative to this, NOT the section */}
      <div className="relative">

        {/* Left arrow */}
        <button
          onClick={() => scroll("left")}
          onMouseEnter={() => setHoveredArrow("left")}
          onMouseLeave={() => setHoveredArrow(null)}
          className={`absolute left-2 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20 backdrop-blur-sm transition-all duration-300 md:flex ${
            hoveredArrow === "left" ? "h-11 w-11" : "h-9 w-9"
          } ${
            isHoveringRow && canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-label="เลื่อนซ้าย"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-5 w-5">
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
          } ${
            isHoveringRow && canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-label="เลื่อนขวา"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-5 w-5">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto overflow-y-visible pb-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4"
          onScroll={updateScrollState}
        >
          {items.map((book) => (
            <BookCard
              key={`${rowId}-${book.id}`}
              book={book}
              rowId={rowId}
            />
          ))}

          {/* See-more card — last item in the scroll row */}
          {seeMoreHref && (
            <Link
              href={seeMoreHref}
              className="group flex w-[9.5rem] min-w-[9.5rem] shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 transition-all duration-300 hover:border-white/25 hover:bg-white/8 md:w-[13.75rem] md:min-w-[13.75rem]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 transition-all duration-300 group-hover:border-white/30 group-hover:bg-white/15">
                <svg className="h-5 w-5 text-white/60 transition group-hover:text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-xs font-medium text-white/50 transition group-hover:text-white/90">ดูเพิ่มเติม</p>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
