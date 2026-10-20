import { createApi } from "./api.ts";
import type { Book } from "./catalog.ts";

export type LandingRow = {
  id: string;
  title: string;
  query: string;
  items: Book[];
};
export type Landing = {
  hero: Book | null;
  rows: LandingRow[];
  updatedAt: string;
  fromStaleCache?: boolean;
  staleUpdatedAt?: string;
  apiOffline?: boolean;
};
export type ReleaseTab = "new" | "latest" | "popular" | "top-rated";
export type BrowseSelection =
  | { kind: "new"; tab: ReleaseTab; tag?: string; page?: number }
  | { kind: "genre"; slug: string; page?: number };
export type Listing = { items: Book[]; total: number };
export type Related = {
  mangaId: string | null;
  items: Book[];
  loading: boolean;
  error: string | null;
};
export type DiscoveryState = {
  landing: Landing | null;
  homeLoading: boolean;
  homeError: string | null;
  selection: BrowseSelection | null;
  items: Book[];
  total: number;
  loading: boolean;
  error: string | null;
  related: Related;
};
export function createDiscovery(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
}) {
  const api = createApi(options);
  let state: DiscoveryState = {
    landing: null,
    homeLoading: false,
    homeError: null,
    selection: null,
    items: [],
    total: 0,
    loading: false,
    error: null,
    related: { mangaId: null, items: [], loading: false, error: null },
  };
  const listeners = new Set<() => void>();
  let browseGeneration = 0;
  let relatedGeneration = 0;
  let homeGeneration = 0;
  const requests: Record<
    "home" | "browse" | "related",
    AbortController | null
  > = { home: null, browse: null, related: null };
  function begin(channel: keyof typeof requests) {
    requests[channel]?.abort();
    const controller = new AbortController();
    requests[channel] = controller;
    return controller.signal;
  }
  const publish = (next: DiscoveryState) => {
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
    async home() {
      const current = ++homeGeneration;
      const signal = begin("home");
      publish({ ...state, homeLoading: true, homeError: null });
      try {
        const landing = await api.json<Landing>("books/landing", { signal });
        if (current !== homeGeneration) return;
        publish({ ...state, landing, homeLoading: false });
      } catch {
        if (current === homeGeneration)
          publish({
            ...state,
            homeLoading: false,
            homeError: "เชื่อมต่อ MangaDock ไม่ได้ กรุณาลองอีกครั้ง",
          });
      }
    },
    cancel() {
      homeGeneration++;
      browseGeneration++;
      relatedGeneration++;
      Object.values(requests).forEach((controller) => controller?.abort());
      publish({
        ...state,
        homeLoading: false,
        loading: false,
        related: { ...state.related, loading: false },
      });
    },
    async browse(selection: BrowseSelection) {
      const current = ++browseGeneration;
      const signal = begin("browse");
      publish({
        ...state,
        selection,
        items: [],
        total: 0,
        loading: true,
        error: null,
      });
      try {
        const query = new URLSearchParams({
          page: String(selection.page ?? 1),
          limit: "28",
        });
        if (
          selection.kind === "new" &&
          selection.tag &&
          selection.tag !== "all"
        )
          query.set("tag", selection.tag);
        const listing =
          selection.kind === "genre"
            ? await api.json<Listing>(
                `books/genre/${encodeURIComponent(selection.slug)}?${query}`,
                { signal },
              )
            : (
                await api.json<Record<ReleaseTab, Listing>>(
                  `books/new-releases?${query}`,
                  { signal },
                )
              )[selection.tab];
        if (current !== browseGeneration) return;
        publish({ ...state, selection, ...listing, loading: false });
      } catch (failure) {
        if (current === browseGeneration)
          publish({
            ...state,
            loading: false,
            error: "โหลดรายการไม่สำเร็จ กรุณาลองอีกครั้ง",
          });
      }
    },
    async related(mangaId: string) {
      const current = ++relatedGeneration;
      const signal = begin("related");
      publish({
        ...state,
        related: { mangaId, items: [], loading: true, error: null },
      });
      try {
        const items = await api.json<Book[]>(
          `books/${encodeURIComponent(mangaId)}/related?limit=10`,
          { signal },
        );
        if (current !== relatedGeneration) return;
        publish({
          ...state,
          related: { mangaId, items, loading: false, error: null },
        });
      } catch {
        if (current === relatedGeneration)
          publish({
            ...state,
            related: {
              mangaId,
              items: [],
              loading: false,
              error: "โหลดมังงะที่คล้ายกันไม่สำเร็จ",
            },
          });
      }
    },
  };
}
