import { createApi } from "./api.ts";

export type Book = {
  id: string;
  title: string;
  thumbnail: string;
  thumbnailLocal?: string;
  thumbnailCached?: boolean;
  description?: string;
  authors?: string[];
  categories?: string[];
};
export type Chapter = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
  translatedLanguage: string;
  priceCoins?: number;
  source?: "mangadex" | "studio";
  translatorName?: string | null;
};
type Version = {
  versionId: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  priceCoins: number;
  status: string;
  translatorName?: string | null;
  backendAvailable?: boolean;
};
export type BookDetail = {
  id: string;
  title?: string;
  authors: string[];
  genres: string[];
  description?: string;
  covers: Array<{ url: string }>;
};
export type CatalogState = {
  query: string;
  results: Book[];
  total: number;
  book: BookDetail | null;
  chapters: Chapter[];
};

export function createCatalog(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
}) {
  let state: CatalogState = {
    query: "",
    results: [],
    total: 0,
    book: null,
    chapters: [],
  };
  const api = createApi(options);
  let generation = 0;
  let offset = 0;
  let loadingMore: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: CatalogState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    closeBook() {
      generation++;
      publish({ ...state, book: null, chapters: [] });
    },
    loadMore(): Promise<void> {
      if (loadingMore) return loadingMore;
      if (offset >= state.total) return Promise.resolve();
      const current = generation;
      loadingMore = (async () => {
        const response = await api.json<{ items: Book[]; total: number }>(
          `books/search?q=${encodeURIComponent(state.query)}&limit=30&offset=${offset}`,
        );
        if (current !== generation) return;
        offset += response.items.length;
        const known = new Set(state.results.map((book) => book.id));
        publish({
          ...state,
          results: [
            ...state.results,
            ...response.items.filter((book) => !known.has(book.id)),
          ],
          total: response.items.length ? response.total : offset,
        });
      })().finally(() => {
        loadingMore = null;
      });
      return loadingMore;
    },
    async openBook(id: string) {
      const current = ++generation;
      const [book, original, versions] = await Promise.all([
        api.json<BookDetail>(`books/manga/${encodeURIComponent(id)}`),
        api.json<Chapter[]>(`books/manga/${encodeURIComponent(id)}/chapters`),
        api.json<Version[]>(`versions/title/${encodeURIComponent(id)}`),
      ]);
      const uploaded: Chapter[] = versions
        .filter(
          (item) =>
            item.status === "published" && item.backendAvailable !== false,
        )
        .map((item) => ({
          id: `ver:${item.versionId}`,
          chapterNumber: item.chapterNumber || null,
          title: item.chapterTitle || null,
          translatedLanguage: item.language || "th",
          priceCoins: item.priceCoins,
          source: "studio",
          translatorName: item.translatorName,
        }));
      const chapters = [
        ...original.map((chapter) => ({
          ...chapter,
          source: "mangadex" as const,
        })),
        ...uploaded,
      ].sort(
        (a, b) =>
          (parseFloat(a.chapterNumber ?? "0") || 0) -
          (parseFloat(b.chapterNumber ?? "0") || 0),
      );
      if (current === generation) publish({ ...state, book, chapters });
    },
    async search(query: string) {
      const current = ++generation;
      const response = await api.json<{ items: Book[]; total: number }>(
        `books/search?q=${encodeURIComponent(query)}&limit=30&offset=0`,
      );
      if (current === generation) {
        offset = response.items.length;
        publish({
          ...state,
          query,
          results: response.items,
          total: response.total,
        });
      }
    },
  };
}
