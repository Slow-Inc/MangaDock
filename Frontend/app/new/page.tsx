"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "../components/Navbar";
import MangaGrid, { GridBook } from "../components/MangaGrid";

const API_BASE = "/api/proxy";

const PAGE_SIZE = 28;

type SectionData = { items: GridBook[]; total: number };
type TabKey = "new" | "latest" | "popular" | "top-rated";

type NewReleasesResponse = {
  new: SectionData;
  latest: SectionData;
  popular: SectionData;
  "top-rated": SectionData;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "new",       label: "มังงะมาใหม่" },
  { key: "latest",    label: "อัปเดตล่าสุด" },
  { key: "popular",   label: "มังงะยอดนิยม" },
  { key: "top-rated", label: "มังงะเรตติ้งสูง" },
];

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

  const scroll = (dir: -1 | 1) => scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });

  if (categories.length <= 1) return null;
  return (
    <div className="relative mb-6">
      {canLeft && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-linear-to-r from-[#0a0a0a] to-transparent" />
          <button aria-label="เลื่อนซ้าย" onClick={() => scroll(-1)}
            className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0a] p-1.5 text-white/60 transition hover:border-white/30 hover:text-white">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((cat) => (
          <button key={cat} onClick={() => onSelect(cat)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active === cat ? "bg-white text-black" : "bg-white/8 text-white/55 hover:bg-white/15 hover:text-white/80"
            }`}>
            {cat === "all" ? "ทั้งหมด" : cat}
          </button>
        ))}
      </div>
      {canRight && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-linear-to-l from-[#0a0a0a] to-transparent" />
          <button aria-label="เลื่อนขวา" onClick={() => scroll(1)}
            className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-[#0a0a0a] p-1.5 text-white/60 transition hover:border-white/30 hover:text-white">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}
    </div>
  );
}

function useSectionPage(order: TabKey, tagFilter: string) {
  const [page, setPage]       = useState(1);
  const [data, setData]       = useState<SectionData>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (tagFilter !== "all") qs.set("tag", tagFilter);
    fetch(`${API_BASE}/books/new-releases?${qs}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((res: NewReleasesResponse) => setData(res[order]))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, order, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  return { page, setPage, data, loading, error, totalPages };
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNums = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => start + i,
  );

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <p className="text-xs text-white/40">
        หน้า {page} / {totalPages} — {total.toLocaleString()} รายการทั้งหมด
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          «
        </button>
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← ก่อนหน้า
        </button>

        {pageNums.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-9 w-9 rounded-lg text-sm transition ${
              p === page
                ? "bg-white font-semibold text-black"
                : "border border-white/10 text-white/50 hover:border-white/30 hover:text-white"
            }`}
          >
            {p}
          </button>
        ))}

        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          ถัดไป →
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          »
        </button>
      </div>
    </div>
  );
}

// Duration must match the CSS transition duration below (300 ms).
const TRANSITION_MS = 300;

function Section({ order }: { order: TabKey }) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { page, setPage, data, loading, error, totalPages } =
    useSectionPage(order, categoryFilter);

  // Stable chip list — only captured from the unfiltered ("all") results so
  // chips don't disappear or change when the user selects a filter.
  const [stableCategories, setStableCategories] = useState<string[]>([]);

  // `visible` drives the CSS transition independently of `loading` so that
  // even a near-instant fetch always plays a full fade-out before fading in.
  const [visible, setVisible] = useState(true);
  const fadeOutStartRef = useRef<number>(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: start the fade-out and record when it began.
  const startFadeOut = () => {
    setVisible(false);
    fadeOutStartRef.current = Date.now();
  };

  // reset category filter when tab changes — parent tab switcher already
  // handles its own transition, so just reset state here.
  useEffect(() => {
    setCategoryFilter("all");
    setPage(1);
    setStableCategories([]);
    setVisible(true); // tab switcher owns the outer animation
  }, [order, setPage]);

  // Rebuild the chip list only when viewing unfiltered results.
  useEffect(() => {
    if (categoryFilter !== "all") return;
    if (data.items.length === 0) return;
    const cats = new Set<string>();
    data.items.forEach((b) => (b.categories ?? []).forEach((c: string) => cats.add(c)));
    if (cats.size > 0) setStableCategories(["all", ...[...cats].sort()]);
  }, [data.items, categoryFilter]);

  // When the fetch finishes, wait for the remainder of TRANSITION_MS before
  // fading in — guarantees the full fade-out plays even for sub-300 ms loads.
  useEffect(() => {
    if (loading) return;
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    const elapsed = Date.now() - fadeOutStartRef.current;
    const remaining = Math.max(0, TRANSITION_MS - elapsed);
    fadeTimerRef.current = setTimeout(() => setVisible(true), remaining);
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, [loading]);

  const handlePageChange = (p: number) => {
    startFadeOut();
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleChipSelect = (cat: string) => {
    startFadeOut();
    setCategoryFilter(cat);
    setPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section>
      {/* Stats row */}
      {data.total > 0 && (
        <p className="mb-5 text-xs text-white/30">
          {data.total.toLocaleString()} เรื่อง · หน้า {page}/{totalPages}
          {categoryFilter !== "all" && ` · ${categoryFilter}`}
        </p>
      )}

      {/* ChipBar is always mounted so it never re-renders on filter change */}
      <ChipBar
        categories={stableCategories}
        active={categoryFilter}
        onSelect={handleChipSelect}
      />

      {/* Grid area — fade + slide, same style as the tab switcher above.
          `visible` is controlled with a minimum fade-out duration so the
          animation always completes regardless of how fast the data loads. */}
      <div
        className={`transition-all duration-300 ease-out ${
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        {error ? (
          <p className="py-16 text-center text-sm text-white/40">
            ไม่สามารถโหลดข้อมูลได้
          </p>
        ) : (
          <MangaGrid books={data.items} />
        )}
      </div>

      {visible && !error && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={data.total}
          onPageChange={handlePageChange}
        />
      )}
    </section>
  );
}

export default function NewBooksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <NewBooksPageInner />
    </Suspense>
  );
}

function NewBooksPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") ?? "new") as TabKey;
  const [activeTab, setActiveTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : "new"
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />

      <main className="page-shell page-shell-nav page-shell-wide">
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            หนังสือทั้งหมด
          </h1>
          <p className="mt-1 text-sm text-white/40">
            เรียกดูมังงะตามหมวดที่คุณสนใจ
          </p>
        </div>

        {/* Tab bar */}
        <div className="mobile-tabs-scroll mb-6 flex gap-0 overflow-x-auto whitespace-nowrap border-b border-white/10 sm:mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors sm:px-5 ${
                activeTab === tab.key
                  ? "text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>

        {/* Sections — all mounted to preserve pagination state per tab */}
        <div className="relative">
          {TABS.map((tab) => (
            <div
              key={tab.key}
              className={`transition-all duration-300 ease-out ${
                activeTab === tab.key
                  ? "relative translate-y-0 opacity-100"
                  : "pointer-events-none absolute inset-x-0 top-0 translate-y-3 opacity-0"
              }`}
            >
              <Section order={tab.key} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
