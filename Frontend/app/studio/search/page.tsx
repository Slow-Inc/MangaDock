"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { searchBooks, StudioBook } from "../../lib/studioApi";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalLenis } from "../../hooks/useLocalLenis";
import Loader from "../../components/ui/Loader";
import { PickerCover } from "../components/PickerCover";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_QUERY_LENGTH = 2;

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-16 w-12 shrink-0 animate-pulse rounded-xl bg-fill" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-fill" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-fill" />
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
    <div className="flex h-full flex-col bg-bg text-ink">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg px-4 py-3">
        <button
          onClick={() => router.back()}
          aria-label="กลับ"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-fill hover:text-ink active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">ค้นหามังงะ</p>
          <p className="text-[11px] text-ink-3">เลือกเรื่องสำหรับอัปโหลดงานแปล</p>
        </div>
      </div>

      {/* Search input area */}
      <div className="px-4 pt-5 pb-2">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3"
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
        </form>

        {/* Result count */}
        {isSearchReady && !searching && hasSearched && (
          <p className="mt-2.5 text-xs text-ink-3">
            {results.length > 0 ? `พบ ${results.length} รายการ` : null}
          </p>
        )}
      </div>

      {/* Results area */}
      <div ref={scrollRef} className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">

        {/* Empty / initial state */}
        {!isSearchReady && !searching && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-fill border border-line">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-ink-3">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-2">พิมพ์ชื่อมังงะเพื่อเริ่มต้น</p>
              <p className="mt-1 text-xs text-ink-3">ค้นหาจากฐานข้อมูล MangaDock</p>
            </div>
          </div>
        )}

        {/* Skeleton loading */}
        {searching && (
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* No results */}
        {!searching && hasSearched && results.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-fill border border-line">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-ink-3">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-2">ไม่พบผลลัพธ์</p>
              <p className="mt-1 text-xs text-ink-3">ลองค้นหาด้วยคำอื่น</p>
            </div>
          </div>
        )}

        {/* Results list */}
        {!searching && results.length > 0 && (
          <div className="divide-y divide-line">
            {results.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => handleSelect(book)}
                className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-fill active:bg-raised"
              >
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-fill border border-line">
                  <PickerCover book={book} sizes="48px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{book.title}</p>
                  {book.subtitle && <p className="mt-0.5 truncate text-xs text-ink-3">{book.subtitle}</p>}
                  {book.authors && book.authors.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-accent/60">{book.authors[0]}</p>
                  )}
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-ink-3">
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

