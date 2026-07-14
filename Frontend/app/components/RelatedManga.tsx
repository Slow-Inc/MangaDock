"use client";

import { useEffect, useRef, useState } from "react";
import BookDetailModal from "./BookDetailModal";
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
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl border border-white/10 bg-white/5">
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
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        </div>
        <p className="line-clamp-2 text-[11px] leading-snug text-white/70 transition group-hover:text-white">
          {book.title}
        </p>
      </button>
      {showModal && <BookDetailModal book={book} onClose={() => setShowModal(false)} />}
    </>
  );
}

export default function RelatedManga({ mangaId }: { mangaId: string }) {
  const [items, setItems] = useState<LandingBook[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <section className="mt-6">
      <h3 className="mb-3 text-sm font-bold text-white">มังงะที่คล้ายกัน</h3>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((book) => (
          <RelatedCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}
