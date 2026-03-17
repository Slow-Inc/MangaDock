"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { searchBooks, StudioBook, getBookCoverUrl } from "../../lib/studioApi";
import { resolvedThumbnail } from "../../lib/imgUrl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalLenis } from "../../hooks/useLocalLenis";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_QUERY_LENGTH = 2;

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-16 w-12 shrink-0 animate-pulse rounded-xl bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/8" />
      </div>
    </div>
  );
}

function SearchContent() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudioBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLocalLenis(scrollRef, "vertical", true);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
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
  }, [query]);

  const handleSelect = useCallback((book: StudioBook) => {
    sessionStorage.setItem("mb:studio:selectedBook", JSON.stringify(book));
    router.back();
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inputRef.current?.blur();
  };

  if (!user) return null;

  const trimmedQuery = query.trim();
  const isSearchReady = trimmedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  return (
    <div className="flex h-dvh flex-col bg-[#0d0d0d] text-white">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/8 bg-[#0d0d0d]/95 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label="กลับ"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">ค้นหามังงะ</p>
          <p className="text-[11px] text-white/35">เลือกเรื่องสำหรับอัปโหลดงานแปล</p>
        </div>
      </div>

      {/* Search input area */}
      <div className="px-4 pt-5 pb-2">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อมังงะ..."
              className="w-full rounded-2xl border border-white/12 bg-white/5 py-3 pl-12 pr-12 text-base text-white placeholder-white/25 outline-none transition focus:border-white/25 focus:bg-white/8"
            />
            {searching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            )}
            {!searching && query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/50 transition hover:bg-white/20 hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </form>

        {/* Result count */}
        {isSearchReady && !searching && hasSearched && (
          <p className="mt-2.5 text-xs text-white/35">
            {results.length > 0 ? `พบ ${results.length} รายการ` : null}
          </p>
        )}
      </div>

      {/* Results area */}
      <div ref={scrollRef} className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))]">

        {/* Empty / initial state */}
        {!isSearchReady && !searching && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/8">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-white/25">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/50">พิมพ์ชื่อมังงะเพื่อเริ่มต้น</p>
              <p className="mt-1 text-xs text-white/25">ค้นหาจากฐานข้อมูล MangaDock</p>
            </div>
          </div>
        )}

        {/* Skeleton loading */}
        {searching && (
          <div className="divide-y divide-white/5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* No results */}
        {!searching && hasSearched && results.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/8">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-white/25">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/50">ไม่พบผลลัพธ์</p>
              <p className="mt-1 text-xs text-white/25">ลองค้นหาด้วยคำอื่น</p>
            </div>
          </div>
        )}

        {/* Results list */}
        {!searching && results.length > 0 && (
          <div className="divide-y divide-white/5">
            {results.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => handleSelect(book)}
                className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/8"
              >
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-white/8 border border-white/8">
                  {book.thumbnail ? (
                    <img
                      src={resolvedThumbnail(book as any)}
                      alt={book.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{book.title}</p>
                  {book.subtitle && <p className="mt-0.5 truncate text-xs text-white/35">{book.subtitle}</p>}
                  {book.authors && book.authors.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-indigo-400/60">{book.authors[0]}</p>
                  )}
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-white/20">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudioSearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}

