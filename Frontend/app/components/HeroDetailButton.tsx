"use client";

import { useEffect, useState } from "react";
import BookDetailModal from "./BookDetailModal";

const API_BASE = "/api/proxy";

type LandingBook = {
  id: string;
  title: string;
  subtitle: string;
  authors: string[];
  description: string;
  thumbnail: string;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
};

type Props = { book: LandingBook };

type MangaChapterSummary = {
  pageCount: number;
  pagesAvailable?: boolean;
  readerAvailable?: boolean;
  isOfflineFallback?: boolean;
};

export default function HeroDetailButton({ book }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [scrollToChapters, setScrollToChapters] = useState(false);
  const [hasReadable, setHasReadable] = useState<boolean | null>(null); // null = loading
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(book.id);
  const isManga = isUUID || book.thumbnail.includes("mangadex.org");

  useEffect(() => {
    if (!isManga) return;
    const forceLocal = localStorage.getItem("imgCacheForceLocal") === "1";
    const qs = forceLocal ? "?forceLocal=true" : "";

    fetch(`${API_BASE}/books/manga/${book.id}/chapters${qs}`)
      .then((r) => r.json())
      .then((d: MangaChapterSummary[]) => {
        setHasReadable(d.some((ch) => {
          if (forceLocal || ch.isOfflineFallback) {
            return ch.readerAvailable === true;
          }
          return ch.pageCount > 0 || ch.pagesAvailable === true;
        }));
      })
      .catch(() => setHasReadable(false));
  }, [book.id, isManga]);

  function openDetail() {
    setScrollToChapters(false);
    setShowModal(true);
  }

  function openRead() {
    setScrollToChapters(true);
    setShowModal(true);
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {/* Show อ่านเลย only when manga AND confirmed has readable chapters */}
        {isManga && hasReadable === true && (
          <button
            onClick={openRead}
            className="rounded-lg bg-white px-8 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
          >
            อ่านเลย
          </button>
        )}
        <button
          onClick={openDetail}
          className="rounded-lg border border-white/25 bg-white/10 px-8 py-2.5 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/20"
        >
          รายละเอียดเพิ่มเติม
        </button>
      </div>

      {showModal && (
        <BookDetailModal
          book={book}
          onClose={() => setShowModal(false)}
          scrollToChapters={scrollToChapters}
        />
      )}
    </>
  );
}
