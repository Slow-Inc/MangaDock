"use client";

import Image from "next/image";
import { useState } from "react";
import BookDetailModal from "./BookDetailModal";
import { resolvedThumbnail } from "../lib/imgUrl";
import type { LandingBook } from "../lib/types";

type Props = {
  book: LandingBook;
  index: number;
};

export default function TopTenCard({ book, index }: Props) {
  const [isLandscape, setIsLandscape] = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <article className="group relative flex min-w-[10.5rem] items-end gap-2 sm:min-w-[12rem] md:min-w-[15rem] md:gap-3">
      <span className="pointer-events-none text-6xl font-black leading-none text-white/20 sm:text-7xl md:text-8xl">
        {index + 1}
      </span>
      <div
        onClick={() => setShowModal(true)}
        className={`relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/10 md:backdrop-blur-xl transition-all duration-300 hover:border-white/30 hover:scale-105 ${
          isLandscape ? "aspect-4/3 w-32 sm:w-40 md:w-48" : "h-32 w-24 sm:h-36 sm:w-28 md:h-40 md:w-28"
        }`}
      >
        {book.thumbnailCached === false ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" /><path d="M16 3v4M8 3v4" /></svg>
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
          sizes="192px"
        />
        )}
      </div>

      {showModal && (
        <BookDetailModal book={book} onClose={() => setShowModal(false)} />
      )}
    </article>
  );
}
