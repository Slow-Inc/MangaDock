"use client";

import { useEffect, useState } from "react";
import BookDetailModal from "./BookDetailModal";
import { useHorizontalScroll } from "../hooks/useHorizontalScroll";
import { resolvedThumbnail, thumbnailFallbackSrc } from "../lib/imgUrl";
import { cacheOrFetch, TTL } from "../lib/apiCache";
import type { LandingBook } from "../lib/types";

const API_BASE = "/api/proxy";

function RelatedCard({ book }: { book: LandingBook }) {
  const [thumbSrc, setThumbSrc] = useState(() => resolvedThumbnail(book));
  const [thumbFellBack, setThumbFellBack] = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="group flex w-[7.5rem] min-w-[7.5rem] shrink-0 flex-col gap-2 text-left"
      >
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl border border-line bg-fill">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbSrc}
            alt={book.title}
            onError={() => {
              if (!thumbFellBack) {
                const fallback = thumbnailFallbackSrc(book);
                setThumbFellBack(true);
                if (fallback) setThumbSrc(fallback);
              }
            }}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-linear-to-t from-bg/60 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        </div>
        <p className="line-clamp-2 text-[11px] leading-snug text-ink-2 transition group-hover:text-ink">
          {book.title}
        </p>
      </button>
      {showModal && <BookDetailModal book={book} onClose={() => setShowModal(false)} />}
    </>
  );
}

function ScrollArrow({
  dir,
  visible,
  onClick,
}: {
  dir: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "left" ? "เลื่อนซ้าย" : "เลื่อนขวา"}
      // top = half the 2:3 cover height (7.5rem wide -> 11.25rem tall), so it centres on the covers, not the titles
      className={`absolute ${dir === "left" ? "left-1" : "right-1"} top-[5.625rem] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-bg/70 ring-1 ring-ink-3 backdrop-blur-sm transition hover:bg-bg/90 md:flex ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-ink" aria-hidden>
        <path d={dir === "left" ? "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" : "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"} />
      </svg>
    </button>
  );
}

export default function RelatedManga({ mangaId }: { mangaId: string }) {
  const [items, setItems] = useState<LandingBook[]>([]);
  const [loading, setLoading] = useState(true);
  const { ref, canScrollLeft, canScrollRight, update, scrollBy } = useHorizontalScroll();

  useEffect(() => {
    update();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` only reads the ref; re-measure when the items change
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    cacheOrFetch<LandingBook[]>(
      `related:${mangaId}`,
      async () => {
        const r = await fetch(`${API_BASE}/books/${mangaId}/related?limit=10`);
        return r.json();
      },
      TTL.LONG,
    )
      .then((data) => {
        if (!cancelled) {
          setItems(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [mangaId]);

  if (loading || items.length === 0) return null;

  return (
    <section className="mt-6 px-6 pb-6">
      <h3 className="mb-3 text-sm font-bold text-ink">มังงะที่คล้ายกัน</h3>
      <div className="relative">
        <ScrollArrow dir="left" visible={canScrollLeft} onClick={() => scrollBy("left")} />
        <ScrollArrow dir="right" visible={canScrollRight} onClick={() => scrollBy("right")} />
        <div
          ref={ref}
          onScroll={update}
          className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((book) => (
            <RelatedCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </section>
  );
}
