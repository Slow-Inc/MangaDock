"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import MangaGrid, { GridBook } from "../../components/MangaGrid";
import { cacheOrFetch, TTL } from "../../lib/apiCache";
import Loader from "../../components/ui/Loader";

const API_BASE = "/api/proxy";

const GENRES: Record<string, string> = {
  action: "แอคชัน",
  adventure: "ผจญภัย",
  comedy: "ตลก",
  romance: "โรแมนติก",
  fantasy: "แฟนตาซี",
  drama: "ดราม่า",
  horror: "สยองขวัญ",
  "sci-fi": "ไซไฟ",
  "slice-of-life": "ชีวิตประจำวัน",
  sports: "กีฬา",
  mystery: "ลึกลับ",
  psychological: "จิตวิทยา",
  supernatural: "เหนือธรรมชาติ",
  historical: "ประวัติศาสตร์",
  isekai: "อิเซไค",
  mecha: "หุ่นยนต์",
  "school-life": "ชีวิตนักเรียน",
  thriller: "ระทึกขวัญ",
};

const PAGE_SIZE = 28;

export default function GenrePage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.genre === "string" ? params.genre : "";
  const genreLabel = GENRES[slug] ?? slug;

  const [books, setBooks] = useState<GridBook[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    queueMicrotask(() => {
      setLoading(true);
      setError(false);
    });
    cacheOrFetch<{ items: GridBook[]; total: number }>(
      `genre:${slug}:${page}`,
      async () => {
        const r = await fetch(`${API_BASE}/books/genre/${slug}?page=${page}&limit=${PAGE_SIZE}`);
        if (!r.ok) throw new Error();
        return r.json();
      },
      TTL.LONG,
    )
      .then((data) => {
        setBooks(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isPrevDisabled = page <= 1;
  const isNextDisabled = page >= totalPages;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Navbar />

      <main className="page-shell page-shell-nav page-shell-wide">
        {/* Breadcrumb */}
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-ink-3 sm:mb-6 sm:text-sm">
          <button
            onClick={() => router.back()}
            className="text-ink-2 transition-colors hover:text-ink"
          >
            ← ย้อนกลับ
          </button>
          <span>/</span>
          <span className="text-ink-2">{genreLabel}</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-ink md:text-3xl">
              {genreLabel}
            </h1>
            {total > 0 && (
              <p className="mt-1 text-sm text-ink-3">
                {total.toLocaleString()} เรื่อง · หน้า {page}/{totalPages}
              </p>
            )}
          </div>

          {/* Page jump */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={isPrevDisabled}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 text-ink-2"
              >
                ← ก่อนหน้า
              </button>
              <span className="text-xs text-ink-3">
                {page} / {totalPages}
              </span>
              <button
                disabled={isNextDisabled}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 text-ink-2"
              >
                ถัดไป →
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <Loader context="section" />
          </div>
        )}

        {!loading && error && (
          <p className="py-20 text-center text-sm text-ink-3">
            ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง
          </p>
        )}

        {!loading && !error && <MangaGrid books={books} />}

        {/* Bottom pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <p className="text-xs text-ink-3">
              หน้า {page} / {totalPages} — {total.toLocaleString()} รายการทั้งหมด
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                disabled={isPrevDisabled}
                onClick={() => { setPage(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="rounded-lg border border-line px-3 py-2 text-xs text-ink-2 transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                «
              </button>
              <button
                disabled={isPrevDisabled}
                onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="rounded-lg border border-line px-4 py-2 text-sm transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 text-ink-2"
              >
                ← ก่อนหน้า
              </button>

              {/* Page buttons (show up to 5 around current) */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button
                    key={p}
                    onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`h-9 w-9 rounded-lg text-sm transition ${
                      p === page
                        ? "bg-ink text-bg font-semibold"
                        : "border border-line text-ink-2 hover:border-ink-3 hover:text-ink"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                disabled={isNextDisabled}
                onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="rounded-lg border border-line px-4 py-2 text-sm transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 text-ink-2"
              >
                ถัดไป →
              </button>
              <button
                disabled={isNextDisabled}
                onClick={() => { setPage(totalPages); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="rounded-lg border border-line px-3 py-2 text-xs text-ink-2 transition hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                »
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
