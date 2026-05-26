"use client";

import Image from "next/image";
import { useState } from "react";
import BookDetailModal from "./BookDetailModal";
import CoverLightbox from "./CoverLightbox";
import MangaReader from "./MangaReader";
import { getHistory } from "../lib/readingHistory";
import { resolvedThumbnail } from "../lib/imgUrl";

export type GridBook = {
  id: string;
  title: string;
  subtitle: string;
  authors: string[];
  description: string;
  thumbnail: string;
  thumbnailLocal?: string;
  thumbnailCached?: boolean;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
};

interface Props {
  books: GridBook[];
}

function cdnFallback(book: GridBook): string {
  if (!book.thumbnail) return "";
  return book.thumbnail.includes("mangadex.org")
    ? `/api/img-proxy?url=${encodeURIComponent(book.thumbnail)}`
    : book.thumbnail;
}

function GridCard({ book }: { book: GridBook }) {
  const [showModal, setShowModal] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(() => resolvedThumbnail(book));

  // Same source as BookDetailModal — read from history directly, no extra props needed
  const historyEntry = getHistory().find((h) => h.id === book.id);
  const lastChapterId = historyEntry?.lastChapterId;
  const lastChapterNumber = historyEntry?.lastChapterNumber;

  return (
    <>
      <article
        className="group cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        {/* Cover */}
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 smooth-hover group-hover:scale-[1.05] group-hover:border-white/25 group-hover:shadow-xl group-hover:shadow-black/50">
          {book.thumbnailCached === false ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-white/5 text-white/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
                <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
              </svg>
            </div>
          ) : (
            <Image
              src={thumbSrc}
              alt={book.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 20vw, 14vw"
              onError={() => setThumbSrc(cdnFallback(book))}
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
          {/* Continue reading button */}
          {lastChapterId && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowReader(true); }}
              className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-1.5 rounded-b-xl bg-black/75 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-[2px] transition-colors hover:bg-black/90 active:bg-black"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0">
                <path d="M8 5v14l11-7z" />
              </svg>
              {lastChapterNumber ? `ตอนที่ ${lastChapterNumber}` : "อ่านต่อ"}
            </button>
          )}
          {/* Expand cover button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowCover(true); }}
            title="ดูหน้าปกขนาดใหญ่"
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 hover:bg-black/80 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="mt-2 space-y-0.5 px-0.5">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-white/90 transition-colors duration-200 group-hover:text-white">
            {book.title}
          </p>
          {book.authors?.length > 0 && (
            <p className="line-clamp-1 text-[10px] text-white/40">
              {book.authors[0]}
            </p>
          )}
          {lastChapterNumber && (
            <p className="text-[10px] text-blue-400/70">
              ตอนที่ {lastChapterNumber}
            </p>
          )}
        </div>
      </article>

      {showModal && (
        <BookDetailModal book={book} onClose={() => setShowModal(false)} />
      )}
      {showCover && (
        <CoverLightbox src={thumbSrc} alt={book.title} onClose={() => setShowCover(false)} />
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
    </>
  );
}

export default function MangaGrid({ books }: Props) {
  if (books.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-white/40">ไม่พบข้อมูล</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {books.map((book) => (
        <GridCard key={book.id} book={book} />
      ))}
    </div>
  );
}
