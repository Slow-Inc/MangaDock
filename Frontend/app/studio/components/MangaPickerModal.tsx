"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLocalLenis } from "../../hooks/useLocalLenis";
import { useModalTransition } from "../../hooks/useModalTransition";
import { searchBooks, StudioBook } from "../../lib/studioApi";
import { resolvedThumbnail } from "../../lib/imgUrl";
import Loader from "../../components/ui/Loader";

const SEARCH_DEBOUNCE_MS = 600;
const MIN_SEARCH_QUERY_LENGTH = 2;

export function MangaPickerModal({
  isOpen,
  onClose,
  onSelect,
  asPage,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (book: StudioBook) => void;
  asPage?: boolean;
}) {
  const pickerRouter = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudioBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);
  const resultsScrollRef = useRef<HTMLDivElement>(null);

  const { mounted, visible } = useModalTransition(isOpen, {
    duration: 300,
    onClosed: () => {
      setQuery("");
      setResults([]);
      setSearching(false);
      setHasSearched(false);
    },
  });

  useLocalLenis(resultsScrollRef, "vertical", mounted && visible);

  // On mobile, redirect to dedicated search page instead of showing modal
  useEffect(() => {
    if (isOpen && !asPage && typeof window !== "undefined" && window.innerWidth < 768) {
      pickerRouter.push("/studio/search");
      onClose();
      return;
    }
  }, [isOpen, asPage, pickerRouter, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      setHasSearched(false);
      return;
    }

    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      setHasSearched(false);
      return;
    }

    setSearching(false);
    setHasSearched(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const requestId = ++searchRequestRef.current;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchBooks(trimmed);
        if (requestId !== searchRequestRef.current) return;
        setResults(data.items);
        setHasSearched(true);
      } catch {
        if (requestId !== searchRequestRef.current) return;
        setResults([]);
        setHasSearched(true);
      } finally {
        if (requestId !== searchRequestRef.current) return;
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen]);

  useEffect(() => {
    if (asPage || !mounted) return;

    const scrollY = window.scrollY;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyOverflow = document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [mounted, asPage]);

  if (!mounted) return null;

  const trimmedQuery = query.trim();
  const isSearchReady = trimmedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  const searchInput = (
    <div className="relative">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3"
      >
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาชื่อมังงะ..."
        className="w-full rounded-2xl border border-line bg-fill py-3 pl-12 pr-12 text-base text-ink placeholder:text-ink-3 outline-none transition focus:border-ink-3 focus:bg-raised"
      />
      {searching && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Loader context="inline" className="text-ink-2" />
        </div>
      )}
      {!searching && query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-fill text-ink-2 transition hover:bg-raised hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  const resultsHeightClass = !isSearchReady
    ? "h-44"
    : searching
      ? "h-56"
      : results.length === 0
        ? "h-44"
        : results.length <= 3
          ? "h-56"
          : "h-[420px]";

  const resultsList = (
    <div
      ref={resultsScrollRef}
      className={asPage ? "custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain" : `custom-scrollbar min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-line bg-bg transition-[height] duration-300 ${resultsHeightClass}`}
    >
      <div>
        {!isSearchReady ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 px-4 text-ink-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-fill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-ink-3">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-ink-3">พิมพ์ชื่อมังงะเพื่อค้นหา</p>
            </div>
          </div>
        ) : searching ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-14 w-10 shrink-0 animate-pulse rounded-xl bg-fill" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded-full bg-fill" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-fill" />
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 px-4 text-ink-3">
            <p className="text-sm">ไม่พบผลลัพธ์สำหรับ &ldquo;{trimmedQuery}&rdquo;</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {results.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => {
                  onSelect(book);
                  onClose();
                }}
                className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-fill active:bg-raised"
              >
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-xl bg-fill border border-line">
                  {book.thumbnail ? (
                    <Image src={resolvedThumbnail({ thumbnail: book.thumbnail })} alt={book.title} fill loading="lazy" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-3">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{book.title}</p>
                  {book.subtitle ? <p className="mt-0.5 truncate text-xs text-ink-3">{book.subtitle}</p> : null}
                  {book.authors && book.authors.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-accent/60">{book.authors[0]}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Full-page mode for mobile
  if (asPage) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg pb-[calc(var(--mobile-nav-height)+1.5rem+env(safe-area-inset-bottom))]">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg px-4 py-3">
          <button
            onClick={onClose}
            aria-label="กลับ"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition hover:bg-fill hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">ค้นหามังงะ</p>
            <p className="text-[11px] text-ink-3">เลือกมังงะสำหรับอัปโหลดงานแปล</p>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {searchInput}
          {resultsList}
        </div>
      </div>
    );
  }

  // Desktop modal mode
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-scrim/70 p-4 pt-12 sm:pt-16 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_50px_90px_-50px_rgb(0_0_0/.45)] transition-all duration-300 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">ค้นหามังงะ</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-ink-2 transition hover:bg-fill hover:text-ink"
          >
            ปิด
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {searchInput}
          {resultsList}
        </div>
      </div>
    </div>
  );
}
