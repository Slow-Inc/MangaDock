"use client";

import Image from "next/image";
import { useState } from "react";
import BookDetailModal from "./BookDetailModal";
import type { LandingBook } from "../lib/types";

type Props = {
  book: LandingBook;
  imageUrl: string;
  titleMain: string;
  titleSub: string;
};

export default function HeroMobileCard({ book, imageUrl, titleMain, titleSub }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <section className="relative px-4 pb-4 pt-20 md:hidden">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="group relative mx-auto block aspect-2/3 w-full max-w-[88%] overflow-hidden rounded-2xl text-left shadow-2xl"
          aria-label={`ดูรายละเอียด ${book.title}`}
        >
          {book.thumbnailCached === false ? (
            <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent" />
          ) : (
            <Image
              src={imageUrl}
              alt={book.title}
              fill
              className="object-cover object-center transition duration-300 group-active:scale-[0.985]"
              priority
              sizes="88vw"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/90 via-black/50 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-5">
            <h1 className="text-2xl font-black leading-tight text-white drop-shadow-lg">
              {titleMain}
            </h1>
            {titleSub && (
              <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-white/80 drop-shadow-lg">
                {titleSub}
              </p>
            )}
          </div>
        </button>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1 text-xs text-white/70">
          {(book.categories.length > 0 ? book.categories : ["E-Book"]).slice(0, 4).map((cat, index) => (
            <span key={cat} className="flex items-center gap-1">
              {index > 0 && <span className="text-white/30">•</span>}
              {cat}
            </span>
          ))}
        </div>
      </section>

      {showModal && (
        <BookDetailModal
          book={book}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}