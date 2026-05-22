"use client";

import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useMemo, useRef } from "react";
import BookDetailModal from "../components/BookDetailModal";
import CoverLightbox from "../components/CoverLightbox";
import Navbar from "../components/Navbar";
import { getFavorites, type CachedBook } from "../lib/userCache";
import { getHistory, type HistoryBook } from "../lib/readingHistory";
import { resolvedThumbnail } from "../lib/imgUrl";
import type { LandingBook } from "../lib/types";

const API_BASE = "/api/proxy";

type Source = "all" | "mylist";

const LANG_OPTIONS = [
  { value: "all", label: "ทุกภาษา" },
  { value: "th",  label: "ภาษาไทย" },
  { value: "en",  label: "English"  },
  { value: "ja",  label: "日本語"   },
];

function cachedToLanding(b: CachedBook): LandingBook {
  return {
    id: b.id, title: b.title, subtitle: b.subtitle ?? "",
    authors: b.authors ?? [], description: b.description ?? "",
    thumbnail: b.thumbnail ?? "", publishedDate: b.publishedDate ?? "",
    categories: b.categories ?? [], averageRating: b.averageRating ?? 0,
    ratingsCount: b.ratingsCount ?? 0,
  };
}

function histToLanding(b: HistoryBook): LandingBook {
  return {
    id: b.id, title: b.title, subtitle: b.subtitle ?? "",
    authors: b.authors ?? [], description: b.description ?? "",
    thumbnail: b.thumbnail ?? "", publishedDate: b.publishedDate ?? "",
    categories: b.categories ?? [], averageRating: 0, ratingsCount: 0,
  };
}

function mergeLocal(): LandingBook[] {
  const seen = new Set<string>();
  const out: LandingBook[] = [];
  for (const b of [...getFavorites().map(cachedToLanding), ...getHistory().map(histToLanding)]) {
    if (!seen.has(b.id)) { seen.add(b.id); out.push(b); }
  }
  return out;
}

// ─── SearchResultCard ────────────────────────────────────────────────────────
function SearchResultCard({ book, onSelect }: { book: LandingBook; onSelect: () => void }) {
  const [showCover, setShowCover] = useState(false);
  const thumb = resolvedThumbnail(book) || "https://placehold.co/200x300/1a1a1a/ffffff?text=No+Cover";
  return (
    <>
      <div className="group flex flex-col gap-2 text-left cursor-pointer" onClick={onSelect}>
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl border border-white/10 transition-all duration-300 group-hover:scale-[1.03] group-hover:border-white/30 group-hover:shadow-lg group-hover:shadow-black/50">
          <Image
            src={thumb}
            alt={book.title}
            fill
            onError={(e) => {
              if (book.thumbnailLocal && book.thumbnail) {
                (e.currentTarget as HTMLImageElement).src =
                  `/api/img-proxy?url=${encodeURIComponent(book.thumbnail)}`;
              }
            }}
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          />
          <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/80 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="text-xs font-semibold text-white">ดูรายละเอียด</span>
          </div>
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
        <div>
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">{book.title}</p>
          {book.authors.length > 0 && <p className="mt-0.5 truncate text-[11px] text-white/45">{book.authors[0]}</p>}
          {book.categories.length > 0 && <p className="mt-1 truncate text-[10px] text-indigo-400/70">{book.categories[0]}</p>}
        </div>
      </div>
      {showCover && <CoverLightbox src={thumb} alt={book.title} onClose={() => setShowCover(false)} />}
    </>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────────────────
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-white text-black" : "bg-white/8 text-white/55 hover:bg-white/15 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

function ChipBar({ categories, active, onSelect }: {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY * 0.8, behavior: "auto" });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", checkScroll);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [categories]);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  if (categories.length <= 1) return null;

  return (
    <div className="relative min-w-0 flex-1">
      {canLeft && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-linear-to-r from-[#0a0a0a] to-transparent" />
          <button
            aria-label="เลื่อนซ้าย"
            onClick={() => scroll(-1)}
            className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0a] p-1.5 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((cat) => (
          <FilterChip key={cat} active={active === cat} onClick={() => onSelect(cat)}>
            {cat === "all" ? "ทั้งหมด" : cat}
          </FilterChip>
        ))}
      </div>

      {canRight && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-linear-to-l from-[#0a0a0a] to-transparent" />
          <button
            aria-label="เลื่อนขวา"
            onClick={() => scroll(1)}
            className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0a] p-1.5 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}
    </div>
  );
}

// ─── SearchResults ────────────────────────────────────────────────────────────
function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") ?? "";

  const [inputValue, setInputValue]       = useState(query);
  const [source, setSource]               = useState<Source>("all");
  const [langFilter, setLangFilter]       = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [apiResults, setApiResults] = useState<LandingBook[]>([]);
  const [apiTotal, setApiTotal]     = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [selectedBook, setSelectedBook] = useState<LandingBook | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const PAGE_SIZE = 28;

  // sync input when URL changes
  useEffect(() => { setInputValue(query); }, [query]);

  // reset page when query / lang / source changes
  useEffect(() => { setPage(1); }, [query, langFilter, source]);

  // fetch from API
  useEffect(() => {
    if (source !== "all") return;
    if (!query.trim()) { setApiResults([]); setApiTotal(0); setSearched(false); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setSearched(false);
    setApiResults([]);
    setApiTotal(0);

    const offset = (page - 1) * PAGE_SIZE;
    const qs = new URLSearchParams({ q: query, limit: String(PAGE_SIZE), offset: String(offset) });
    if (langFilter !== "all") qs.set("lang", langFilter);

    fetch(`${API_BASE}/books/search?${qs}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: { items: LandingBook[]; total: number }) => {
        const items = Array.isArray(data.items) ? data.items : Array.isArray(data as any) ? data as any : [];
        setApiResults(items);
        setApiTotal(data.total ?? items.length);
        setSearched(true);
        setLoading(false);
      })
      .catch((e) => { if ((e as Error).name !== "AbortError") { setApiResults([]); setApiTotal(0); setSearched(true); setLoading(false); } });

    return () => ctrl.abort();
  }, [query, langFilter, source, page]);

  // reset category when base changes
  useEffect(() => { setCategoryFilter("all"); }, [query, langFilter, source]);

  // local books (favorites + history) — must be client-only to avoid hydration mismatch
  const [localBooks, setLocalBooks] = useState<LandingBook[]>([]);
  useEffect(() => { setLocalBooks(mergeLocal()); }, []);

  // source-level results
  const sourceResults = useMemo<LandingBook[]>(() => {
    if (source === "mylist") {
      if (!query.trim()) return localBooks;
      const q = query.toLowerCase();
      return localBooks.filter((b) => b.title.toLowerCase().includes(q) || b.authors.some((a) => a.toLowerCase().includes(q)));
    }
    return apiResults;
  }, [source, localBooks, apiResults, query]);

  // unique categories from source results
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    sourceResults.forEach((b) => b.categories.forEach((c) => cats.add(c)));
    return [...cats].sort();
  }, [sourceResults]);

  // final displayed (category filter)
  const displayed = useMemo(() =>
    categoryFilter === "all" ? sourceResults : sourceResults.filter((b) => b.categories.includes(categoryFilter)),
    [sourceResults, categoryFilter],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    router.push(`/search?q=${encodeURIComponent(inputValue.trim())}`);
  };

  const isMyList  = source === "mylist";
  const isLoading = !isMyList && loading;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />

      <main className="page-shell page-shell-nav page-shell-wide">

        {/* ── Search bar ────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="mb-7 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="ค้นหาหนังสือ, มังงะ..."
              autoFocus
              className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 pl-12 pr-4 text-base text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:bg-white/8"
            />
          </div>
          <button type="submit" className="w-full rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-95 sm:w-auto">
            ค้นหา
          </button>
        </form>

        {/* ── Filter bar ────────────────────────────────────────────── */}
        <div className="mb-7 space-y-3">
          {/* Row 1: แหล่งข้อมูล + ภาษา */}
          <div className="space-y-2 sm:space-y-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 text-[11px] font-medium text-white/30">แหล่งข้อมูล</span>
              <FilterChip active={source === "all"} onClick={() => setSource("all")}>ทั้งหมด</FilterChip>
              <FilterChip active={source === "mylist"} onClick={() => setSource("mylist")}>
                รายการของฉัน
                {localBooks.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-px text-[9px]">{localBooks.length}</span>
                )}
              </FilterChip>

              {!isMyList && (
                <>
                  <span className="mx-1 hidden h-4 w-px shrink-0 bg-white/15 sm:block" />
                  <span className="hidden shrink-0 text-[11px] font-medium text-white/30 sm:block">ภาษา</span>
                  <div className="hidden flex-wrap items-center gap-2 sm:flex">
                    {LANG_OPTIONS.map((opt) => (
                      <FilterChip key={opt.value} active={langFilter === opt.value} onClick={() => setLangFilter(opt.value)}>
                        {opt.label}
                      </FilterChip>
                    ))}
                  </div>
                </>
              )}
            </div>

            {!isMyList && (
              <div className="flex flex-wrap items-center gap-2 sm:hidden">
                <span className="shrink-0 text-[11px] font-medium text-white/30">ภาษา</span>
                {LANG_OPTIONS.map((opt) => (
                  <FilterChip key={opt.value} active={langFilter === opt.value} onClick={() => setLangFilter(opt.value)}>
                    {opt.label}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          {/* Row 2: หมวดหมู่ (dynamic from results) */}
          {availableCategories.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] font-medium text-white/30">หมวดหมู่</span>
              <ChipBar
                categories={["all", ...availableCategories]}
                active={categoryFilter}
                onSelect={setCategoryFilter}
              />
            </div>
          )}
        </div>

        {/* ── Heading ───────────────────────────────────────────────── */}
        {(query || isMyList) && (
          <p className="mb-6 text-sm text-white/45">
            {isLoading
              ? `กำลังค้นหา "${query}"...`
              : isMyList && !query
              ? `รายการของฉัน — ${displayed.length} รายการ`
              : displayed.length > 0
              ? `"${query}" — ${source === "all" && apiTotal > 0 ? apiTotal : displayed.length} รายการ${source === "all" && apiTotal > PAGE_SIZE ? ` (หน้า ${page})` : ""}`
              : null}
          </p>
        )}

        {/* ── Loading skeleton ──────────────────────────────────────── */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="aspect-2/3 w-full animate-pulse rounded-xl bg-white/10" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        )}

        {/* ── Results grid ─────────────────────────────────────────── */}
        {!isLoading && displayed.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {displayed.map((book) => (
              <SearchResultCard key={book.id} book={book} onSelect={() => setSelectedBook(book)} />
            ))}
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────────── */}
        {source === "all" && !isLoading && apiTotal > PAGE_SIZE && (() => {
          const totalPages = Math.ceil(apiTotal / PAGE_SIZE);
          return (
            <div className="mt-10 flex flex-col items-center gap-3">
              <p className="text-xs text-white/40">
                หน้า {page} จาก {totalPages} — {apiTotal} รายการทั้งหมด
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => { setPage(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={page <= 1}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  «
                </button>
                <button
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={page <= 1}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ← ก่อนหน้า
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return (
                    <button
                      key={p}
                      onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className={`h-9 w-9 rounded-lg text-sm font-medium transition ${
                        p === page
                          ? "bg-white text-black"
                          : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/15"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ถัดไป →
                </button>
                <button
                  onClick={() => { setPage(totalPages); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  »
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {!isLoading && (searched || isMyList) && displayed.length === 0 && (query || isMyList) && (
          <div className="flex flex-col items-center gap-4 py-24 text-center text-white/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-16 w-16 opacity-30">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="text-lg font-semibold">
              {isMyList ? (query ? `ไม่พบรายการที่ตรงกับ "${query}"` : "ยังไม่มีรายการในคลังของคุณ") : `ไม่พบหนังสือที่ตรงกับ "${query}"`}
            </p>
            <p className="text-sm">
              {isMyList ? "เพิ่มหนังสือลงรายการของฉัน หรือลองค้นหาจากทั้งหมด" : "ลองใช้คำค้นหาอื่น หรือตรวจสอบการสะกด"}
            </p>
          </div>
        )}

        {/* ── Initial state ─────────────────────────────────────────── */}
        {!query && !isMyList && !isLoading && (
          <div className="flex flex-col items-center gap-4 py-24 text-center text-white/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-16 w-16 opacity-30">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="text-lg font-semibold">พิมพ์คำค้นหาเพื่อเริ่มต้น</p>
          </div>
        )}
      </main>

      {selectedBook && (
        <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
