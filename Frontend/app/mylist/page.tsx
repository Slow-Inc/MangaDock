"use client";

import { Suspense, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "../components/Navbar";
import Mascot from "../components/mascot/Mascot";
import MangaGrid, { GridBook } from "../components/MangaGrid";
import {
  getFavorites,
  isLiked,
  CACHE_EVENT,
  type CachedBook,
} from "../lib/userCache";
import {
  getFollows,
  loadFollows,
  FOLLOW_EVENT,
  type FollowedSeries,
} from "../hooks/useSeriesFollow";
import {
  getHistory,
  HISTORY_EVENT,
  type HistoryBook,
} from "../lib/readingHistory";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { DOT_FIELD, shimmerDelay } from "../components/skeletonDots";
import { scrollBehavior } from "../hooks/reducedMotion";
import { usePageTitle } from "../hooks/pageTitle";

type TabKey = "favorites" | "follows" | "liked" | "history";

const PAGE_SIZE = 28;
const TRANSITION_MS = 300;

const TABS: { key: TabKey; label: string }[] = [
  { key: "favorites", label: "รายการของฉัน" },
  { key: "follows",   label: "ติดตาม" },
  { key: "liked",     label: "ถูกใจ" },
  { key: "history",   label: "อ่านต่อ" },
];

function followToGrid(item: FollowedSeries): GridBook {
  return {
    id:            item.id,
    title:         item.title,
    subtitle:      "",
    authors:       [],
    description:   "",
    thumbnail:     item.thumbnail,
    publishedDate: "",
    categories:    [],
    averageRating: 0,
    ratingsCount:  0,
  };
}

function cachedToGrid(book: CachedBook): GridBook {
  return {
    id:           book.id,
    title:        book.title,
    subtitle:     book.subtitle ?? "",
    authors:      book.authors ?? [],
    description:  book.description ?? "",
    thumbnail:    book.thumbnail ?? "",
    publishedDate: book.publishedDate ?? "",
    categories:   book.categories ?? [],
    averageRating: book.averageRating ?? 0,
    ratingsCount:  book.ratingsCount ?? 0,
  };
}

function historyToGrid(book: HistoryBook): GridBook {
  return {
    id:            book.id,
    title:         book.title,
    subtitle:      book.subtitle ?? "",
    authors:       book.authors ?? [],
    description:   book.description ?? "",
    thumbnail:     book.thumbnail ?? "",
    thumbnailLocal: book.thumbnailLocal,
    publishedDate:  book.publishedDate ?? "",
    categories:    book.categories ?? [],
    averageRating:  book.averageRating ?? 0,
    ratingsCount:   book.ratingsCount ?? 0,
  };
}

function Pagination({
  page, totalPages, total, onPageChange,
}: {
  page: number; totalPages: number; total: number; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNums = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-xs text-ink-3">
        หน้า {page} / {totalPages} — {total.toLocaleString()} รายการทั้งหมด
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button disabled={page <= 1} onClick={() => onPageChange(1)}
          className="rounded-lg border border-line px-3 py-2 text-xs text-ink-2 transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">
          «
        </button>
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2 transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">
          ← ก่อนหน้า
        </button>
        {pageNums.map((p) => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`h-9 w-9 rounded-lg text-sm transition ${
              p === page ? "bg-ink font-semibold text-bg" : "border border-line text-ink-2 hover:border-ink-3 hover:text-ink"
            }`}>
            {p}
          </button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2 transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">
          ถัดไป →
        </button>
        <button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}
          className="rounded-lg border border-line px-3 py-2 text-xs text-ink-2 transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">
          »
        </button>
      </div>
    </div>
  );
}

function ChipBar({ categories, active, onSelect }: {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft]   = useState(false);
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

    // non-passive wheel: must be attached via addEventListener to allow preventDefault
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
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: scrollBehavior() });
  };

  if (categories.length <= 1) return null;
  return (
    <div className="relative mb-6">
      {/* Left fade + button */}
      {canLeft && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-linear-to-r from-bg to-transparent" />
          <button
            aria-label="เลื่อนซ้าย"
            onClick={() => scroll(-1)}
            className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-line bg-bg p-1.5 text-ink-2 transition hover:border-ink-3 hover:text-ink"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}

      {/* Scrollable chips */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active === cat
                ? "bg-ink text-bg"
                : "bg-fill text-ink-2 hover:bg-raised hover:text-ink"
            }`}
          >
            {cat === "all" ? "ทั้งหมด" : cat}
          </button>
        ))}
      </div>

      {/* Right fade + button */}
      {canRight && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-linear-to-l from-bg to-transparent" />
          <button
            aria-label="เลื่อนขวา"
            onClick={() => scroll(1)}
            className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-line bg-bg p-1.5 text-ink-2 transition hover:border-ink-3 hover:text-ink"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <Mascot area="reader" size={72} className="mb-4" />
      <p className="text-sm text-ink-3">{label}</p>
    </div>
  );
}

function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <Mascot area="login" size={72} className="mb-4" />
      <p className="mb-4 text-sm text-ink-3">เข้าสู่ระบบเพื่อดูรายการของคุณ</p>
      <button
        onClick={onLogin}
        className="rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-bg transition hover:bg-ink/85 active:scale-95"
      >
        เข้าสู่ระบบ
      </button>
    </div>
  );
}

function MyListContent() {
  const { user, loading, openLoginModal } = useContext(AuthContext);
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabKey>("favorites");
  const [page, setPage]             = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [favorites, setFavorites]   = useState<GridBook[]>([]);
  const [follows, setFollows]       = useState<GridBook[]>([]);
  const [likedBooks, setLikedBooks] = useState<GridBook[]>([]);
  const [history, setHistory]       = useState<GridBook[]>([]);
  const [visible, setVisible] = useState(true);
  const fadeOutStartRef = useRef<number>(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "favorites" || requestedTab === "follows" || requestedTab === "liked" || requestedTab === "history") {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
    setCategoryFilter("all");
    setVisible(true);
  }, [activeTab]);

  useEffect(() => {
    if (visible) return;
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    const elapsed = Date.now() - fadeOutStartRef.current;
    const remaining = Math.max(0, TRANSITION_MS - elapsed);
    fadeTimerRef.current = setTimeout(() => setVisible(true), remaining);
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [visible, page, categoryFilter, activeTab]);

  useEffect(() => {
    const refresh = () => {
      const favs  = getFavorites().map(cachedToGrid);
      const hist  = getHistory()
        .slice()
        .sort((a, b) => b.lastReadAt - a.lastReadAt)
        .map(historyToGrid);

      setFavorites(favs);
      setHistory(hist);
      setFollows(getFollows().map(followToGrid));

      // Liked = books in favs OR hist whose ID is liked
      const seen = new Set<string>();
      const liked: GridBook[] = [];
      for (const b of [...favs, ...hist]) {
        if (!seen.has(b.id) && isLiked(b.id)) {
          seen.add(b.id);
          liked.push(b);
        }
      }
      setLikedBooks(liked);
    };

    refresh();
    window.addEventListener(CACHE_EVENT, refresh);
    window.addEventListener(HISTORY_EVENT, refresh);
    window.addEventListener(FOLLOW_EVENT, refresh);
    return () => {
      window.removeEventListener(CACHE_EVENT, refresh);
      window.removeEventListener(HISTORY_EVENT, refresh);
      window.removeEventListener(FOLLOW_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (user) loadFollows();
  }, [user]);

  const tabBooks: Record<TabKey, GridBook[]> = {
    favorites: favorites,
    follows:   follows,
    liked:     likedBooks,
    history:   history,
  };

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    tabBooks[activeTab].forEach((b) => b.categories.forEach((c) => cats.add(c)));
    return ["all", ...[...cats].sort()];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, favorites, likedBooks, history]);

  const filteredBooks = useMemo(() => {
    const books = tabBooks[activeTab];
    return categoryFilter === "all" ? books : books.filter((b) => b.categories.includes(categoryFilter));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, categoryFilter, favorites, likedBooks, history]);

  const emptyMessages: Record<TabKey, string> = {
    favorites: "ยังไม่มีรายการที่บันทึกไว้",
    follows:   "ยังไม่มี series ที่ติดตาม",
    liked:     "ยังไม่มีรายการที่ถูกใจ",
    history:   "ยังไม่มีประวัติการอ่าน",
  };

  const startFadeOut = () => {
    setVisible(false);
    fadeOutStartRef.current = Date.now();
  };

  const handleExport = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/proxy/users/me/history/export', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reading-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Navbar />

      <main className="page-shell page-shell-nav page-shell-wide">
        {/* Page header */}
        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink md:text-3xl">
              รายการของฉัน
            </h1>
            <p className="mt-1 text-sm text-ink-3">
              มังงะที่คุณบันทึก ถูกใจ และกำลังอ่าน
            </p>
          </div>
          {user && activeTab === "history" && history.length > 0 && (
            <button
              onClick={handleExport}
              className="shrink-0 rounded-xl border border-line px-4 py-2 text-xs font-medium text-ink-2 transition hover:border-ink-3 hover:text-ink active:scale-95"
            >
              Export CSV
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="mobile-tabs-scroll mb-6 flex gap-0 overflow-x-auto whitespace-nowrap border-b border-line sm:mb-8">
          {TABS.map((tab) => {
            const count = tabBooks[tab.key].length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors sm:px-5 ${
                  activeTab === tab.key
                    ? "text-ink"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold transition-colors ${
                      activeTab === tab.key
                        ? "bg-ink/15 text-ink"
                        : "bg-fill text-ink-3"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-ink" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          /* Skeleton while session is restoring — mirrors MangaGrid layout */
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {[...Array(14)].map((_, i) => (
              <div key={i} aria-hidden className="flex flex-col gap-2">
                <div className="aspect-2/3 w-full overflow-hidden rounded-xl bg-fill">
                  <div className={`h-full w-full animate-pulse ${DOT_FIELD}`} style={shimmerDelay(i)} />
                </div>
                <div className="h-3 w-4/5 rounded bg-fill" />
                <div className="h-3 w-3/5 rounded bg-fill" />
              </div>
            ))}
          </div>
        ) : !user ? (
          <LoginPrompt onLogin={openLoginModal} />
        ) : (
          <div key={activeTab} className="tab-fade-in">
            {(() => {
              const books = tabBooks[activeTab];
              if (books.length === 0) return <EmptyState label={emptyMessages[activeTab]} />;

              // Category filter chips
              const chips = (
                <ChipBar
                  categories={availableCategories}
                  active={categoryFilter}
                  onSelect={(cat) => {
                    startFadeOut();
                    setCategoryFilter(cat);
                    setPage(1);
                    window.scrollTo({ top: 0, behavior: scrollBehavior() });
                  }}
                />
              );

              const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
              const paged = filteredBooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
              const handlePageChange = (p: number) => {
                startFadeOut();
                setPage(p);
                window.scrollTo({ top: 0, behavior: scrollBehavior() });
              };
              return (
                <>
                  {chips}
                  <p className="mb-5 text-xs text-ink-3">
                    {filteredBooks.length.toLocaleString()} เรื่อง
                    {categoryFilter !== "all" && ` · ${categoryFilter}`}
                  </p>
                  <div
                    className={`transition-all duration-300 ease-out ${
                      visible
                        ? "translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-3 opacity-0"
                    }`}
                  >
                    {filteredBooks.length === 0
                      ? <EmptyState label="ไม่มีรายการในหมวดหมู่นี้" />
                      : <MangaGrid books={paged} />}
                  </div>
                  {visible && (
                    <Pagination page={page} totalPages={totalPages} total={filteredBooks.length} onPageChange={handlePageChange} />
                  )}
                </>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}

export default function MyListPage() {
  usePageTitle("รายการของฉัน");
  return (
    <Suspense>
      <MyListContent />
    </Suspense>
  );
}
