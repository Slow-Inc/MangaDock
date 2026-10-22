"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BookRow from "./BookRow";
import Mascot from "./mascot/Mascot";
import { CACHE_EVENT, getFavorites, type CachedBook } from "../lib/userCache";
import { getHistory, HISTORY_EVENT, type HistoryBook } from "../lib/readingHistory";
import type { LandingBook, LandingPayload } from "../lib/types";

function cachedToLanding(book: CachedBook): LandingBook {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle ?? "",
    authors: book.authors ?? [],
    description: book.description ?? "",
    thumbnail: book.thumbnail ?? "",
    publishedDate: book.publishedDate ?? "",
    categories: book.categories ?? [],
    averageRating: book.averageRating ?? 0,
    ratingsCount: book.ratingsCount ?? 0,
  };
}

function historyToLanding(book: HistoryBook): LandingBook {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle ?? "",
    authors: book.authors ?? [],
    description: book.description ?? "",
    thumbnail: book.thumbnail ?? "",
    thumbnailLocal: book.thumbnailLocal,
    publishedDate: book.publishedDate ?? "",
    categories: book.categories ?? [],
    averageRating: book.averageRating ?? 0,
    ratingsCount: book.ratingsCount ?? 0,
  };
}

function loadCachedLanding(): LandingBook[] {
  const merged = new Map<string, LandingBook>();

  const history = [...getHistory()].sort((left, right) => right.lastReadAt - left.lastReadAt);
  for (const book of history) {
    merged.set(book.id, historyToLanding(book));
  }

  for (const book of getFavorites()) {
    if (!merged.has(book.id)) {
      merged.set(book.id, cachedToLanding(book));
    }
  }

  return [...merged.values()];
}

export default function HomeCachedLanding() {
  const [cachedBooks, setCachedBooks] = useState<LandingBook[]>([]);
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    const refresh = () => setCachedBooks(loadCachedLanding());

    refresh();
    window.addEventListener(CACHE_EVENT, refresh);
    window.addEventListener(HISTORY_EVENT, refresh);

    return () => {
      window.removeEventListener(CACHE_EVENT, refresh);
      window.removeEventListener(HISTORY_EVENT, refresh);
    };
  }, []);

  return (
    <section>
      {cachedBooks.length > 0 ? (
        <BookRow
          rowId="local-cache"
          rowTitle="จากแคชในเครื่อง"
          items={cachedBooks}
          seeMoreHref="/mylist"
        />
      ) : (
        // Nothing cached in this browser either: say so and offer a retry rather than a blank page (#909).
        // `/` is dynamic and a failed fetch is not data-cached, so refresh() really re-fetches.
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
          <Mascot area="error" state="sleeping" size={72} />
          <p className="text-sm font-medium text-ink">ยังโหลดรายการมังงะไม่ได้</p>
          <p className="text-xs text-ink-3">เซิร์ฟเวอร์ไม่ตอบสนองชั่วคราว ลองใหม่อีกครั้งในอีกสักครู่</p>
          <button
            type="button"
            disabled={retrying}
            onClick={() => startRetry(() => router.refresh())}
            className="mt-1 rounded-xl border border-line bg-fill px-4 py-2 text-sm font-medium text-ink smooth-hover-fast hover:border-ink-3 hover:bg-raised disabled:opacity-60"
          >
            {retrying ? "กำลังโหลด…" : "ลองใหม่"}
          </button>
        </div>
      )}
    </section>
  );
}