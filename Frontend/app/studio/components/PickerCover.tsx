"use client";

import Image from "next/image";
import { useCoverSrc } from "../../hooks/useCoverSrc";

/**
 * A manga picker row's cover (#925): the book glyph when there is no cover or every source fails to load, like the
 * public cards (#921) — never the browser's broken-image icon. A component because the hook cannot run in a `.map`.
 */
export function PickerCover({ book, sizes }: { book: { title: string; thumbnail?: string }; sizes: string }) {
  const cover = useCoverSrc(book);
  if (cover.src) {
    return <Image src={cover.src} alt={book.title} fill loading="lazy" sizes={sizes} onError={cover.onError} className="object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center text-ink-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    </div>
  );
}
