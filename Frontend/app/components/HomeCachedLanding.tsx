"use client";

import { useEffect, useState } from "react";
import BookRow from "./BookRow";
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
      ) : null}
    </section>
  );
}