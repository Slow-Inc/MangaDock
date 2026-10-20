import { createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";

export type Review = {
  id: string;
  uid: string;
  mangaId: string;
  rating: number;
  body: string;
  createdAt: string;
  displayName: string | null;
  photoUrl: string | null;
};
export type CommentContext = {
  mangaId: string;
  chapterId: string;
  pageNumber: number;
};
export type ReaderComment = Omit<Review, "rating"> & CommentContext;
export type ContentReport = {
  contentType: "post" | "manga" | "translation";
  contentId: string;
  reason: "spam" | "inappropriate" | "misinformation" | "copyright" | "other";
  details?: string;
};
export function createReadingSocial(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  let state = {
    reviews: {
      mangaId: "",
      items: [] as Review[],
      summary: { averageRating: 0, count: 0 },
      mine: null as Review | null,
      loading: false,
      error: null as string | null,
    },
    comments: {
      context: null as CommentContext | null,
      items: [] as ReaderComment[],
      loading: false,
      error: null as string | null,
    },
  };
  const api = createApi(options);
  const listeners = new Set<() => void>();
  function publish(next: typeof state) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  let generation = 0;
  let request: AbortController | null = null;
  let commentGeneration = 0;
  let commentRequest: AbortController | null = null;
  const commentChanges = new Map<string, ReaderComment | null>();
  let owner = options.session.snapshot().account?.uid ?? null;
  let identityEpoch = 0;
  const writes = new Set<AbortController>();
  function identityChanged() {
    const next = options.session.snapshot().account?.uid ?? null;
    if (owner === next) return;
    owner = next;
    identityEpoch++;
    generation++;
    commentGeneration++;
    request?.abort();
    commentRequest?.abort();
    writes.forEach((write) => write.abort());
    publish({
      ...state,
      reviews: { ...state.reviews, mine: null, loading: false, error: null },
      comments: { ...state.comments, loading: false, error: null },
    });
  }
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  async function reviewWrite(method: "POST" | "DELETE", body?: object) {
    const current = generation,
      id = state.reviews.mangaId;
    if (!id || options.session.snapshot().status !== "signedIn")
      throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");
    const token = await options.session.accessToken();
    if (!token || current !== generation) return false;
    const controller = new AbortController();
    writes.add(controller);
    try {
      await api.request(`reviews/${encodeURIComponent(id)}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (current !== generation) return false;
      await store.reviews(id);
      return true;
    } finally {
      writes.delete(controller);
    }
  }
  async function commentWrite(
    method: "POST" | "DELETE",
    body?: string,
    id?: string,
  ) {
    const current = commentGeneration,
      context = state.comments.context;
    if (!context || options.session.snapshot().status !== "signedIn")
      throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");
    const token = await options.session.accessToken();
    if (!token || current !== commentGeneration) return false;
    const controller = new AbortController();
    writes.add(controller);
    try {
      const response = await api.request(
        `reader-comments${id ? "/" + encodeURIComponent(id) : ""}`,
        {
          method,
          headers: { Authorization: `Bearer ${token}` },
          body:
            method === "POST"
              ? JSON.stringify({ ...context, body })
              : undefined,
          signal: controller.signal,
        },
      );
      const created =
        method === "POST" ? ((await response.json()) as ReaderComment) : null;
      if (current !== commentGeneration) return false;
      if (created) commentChanges.set(created.id, created);
      else if (id) commentChanges.set(id, null);
      publish({
        ...state,
        comments: {
          ...state.comments,
          items: created
            ? [...state.comments.items, created]
            : state.comments.items.filter((item) => item.id !== id),
        },
      });
      return true;
    } finally {
      writes.delete(controller);
    }
  }
  const store = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async reviews(id: string, offset = 0) {
      const current = ++generation;
      request?.abort();
      request = new AbortController();
      const signal = request.signal;
      publish({
        ...state,
        reviews: {
          ...state.reviews,
          mangaId: id,
          items: [],
          mine: null,
          summary: { averageRating: 0, count: 0 },
          loading: true,
          error: null,
        },
      });
      try {
        const token =
          options.session.snapshot().status === "signedIn"
            ? await options.session.accessToken()
            : null;
        if (current !== generation) return;
        const path = `reviews/${encodeURIComponent(id)}`;
        const [items, summary, mine] = await Promise.all([
          api.json<Review[]>(`${path}?limit=20&offset=${offset}`, { signal }),
          api.json<{ averageRating: number; count: number }>(
            `${path}/summary`,
            { signal },
          ),
          token
            ? api.json<Review | null>(`${path}/my`, {
                headers: { Authorization: `Bearer ${token}` },
                signal,
              })
            : null,
        ]);
        if (current !== generation) return;
        publish({
          ...state,
          reviews: {
            mangaId: id,
            items,
            summary,
            mine,
            loading: false,
            error: null,
          },
        });
      } catch (error) {
        if (current === generation)
          publish({
            ...state,
            reviews: {
              ...state.reviews,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to load reviews",
            },
          });
      }
    },
    saveReview(mangaTitle: string, rating: number, body: string) {
      return reviewWrite("POST", { mangaTitle, rating, body });
    },
    deleteReview() {
      return reviewWrite("DELETE");
    },
    async comments(context: CommentContext) {
      const current = ++commentGeneration;
      commentChanges.clear();
      commentRequest?.abort();
      commentRequest = new AbortController();
      const signal = commentRequest.signal;
      publish({
        ...state,
        comments: { context, items: [], loading: true, error: null },
      });
      try {
        const query = new URLSearchParams({
          mangaId: context.mangaId,
          chapterId: context.chapterId,
          page: String(context.pageNumber),
        });
        const items = await api.json<ReaderComment[]>(
          `reader-comments?${query}`,
          { signal },
        );
        if (current === commentGeneration)
          publish({
            ...state,
            comments: {
              context,
              items: Array.from(
                [...commentChanges]
                  .reduce(
                    (rows, [id, item]) => {
                      if (item) rows.set(id, item);
                      else rows.delete(id);
                      return rows;
                    },
                    new Map(items.map((item) => [item.id, item])),
                  )
                  .values(),
              ),
              loading: false,
              error: null,
            },
          });
      } catch (error) {
        if (current === commentGeneration)
          publish({
            ...state,
            comments: {
              ...state.comments,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to load comments",
            },
          });
      }
    },
    addComment(body: string) {
      return commentWrite("POST", body);
    },
    deleteComment(id: string) {
      return commentWrite("DELETE", undefined, id);
    },
    async report(body: ContentReport) {
      const identity = identityEpoch;
      if (options.session.snapshot().status !== "signedIn")
        throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");
      const token = await options.session.accessToken();
      if (!token || identity !== identityEpoch || !unsubscribe) return false;
      const controller = new AbortController();
      writes.add(controller);
      try {
        await api.request("content-reports", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        return identity === identityEpoch && !controller.signal.aborted;
      } finally {
        writes.delete(controller);
      }
    },
    activate() {
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      identityEpoch++;
      generation++;
      commentGeneration++;
      request?.abort();
      commentRequest?.abort();
      writes.forEach((write) => write.abort());
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
  return store;
}
