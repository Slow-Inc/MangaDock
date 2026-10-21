import { ApiError, createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";
import { readSse } from "./sse.ts";
export type ForumPost = {
  id: string;
  authorUid: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  title: string;
  content: string;
  category: "general" | "announcement" | "spoiler" | "manga_update";
  targetMangaId: string | null;
  targetMangaTitle: string | null;
  imageUrls: string[];
  upvotes: number;
  downvotes: number;
  userVote: number;
  commentCount: number;
  createdAt: string;
  updatedAt?: string;
};
export type FeedFilter = {
  sort?: "new" | "hot";
  category?: ForumPost["category"];
  mangaId?: string;
  authorUid?: string;
};
export type TrendingManga = {
  mangaId: string;
  mangaTitle: string;
  mangaCover: string | null;
  postCount: number;
};
export function createCommunity(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const api = createApi(options);
  let state: {
    items: ForumPost[];
    total: number;
    filter: FeedFilter;
    loading: boolean;
    error: string | null;
    postId: string | null;
    post: ForumPost | null;
    postLoading: boolean;
    postError: string | null;
    newPosts: number;
    trending: TrendingManga[];
    trendingError: string | null;
  } = {
    items: [],
    total: 0,
    filter: { sort: "new" },
    loading: false,
    error: null,
    postId: null,
    post: null,
    postLoading: false,
    postError: null,
    newPosts: 0,
    trending: [],
    trendingError: null,
  };
  const listeners = new Set<() => void>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  let generation = 0,
    trendingGeneration = 0;
  let offset = 0;
  let postGeneration = 0;
  let owner = options.session.snapshot().account?.uid ?? null;
  let stream: AbortController | null = null,
    streamEpoch = 0;
  const newPostIds = new Set<string>();
  const requests: Record<"feed" | "post", AbortController | null> = {
    feed: null,
    post: null,
  };
  function begin(channel: keyof typeof requests) {
    requests[channel]?.abort();
    requests[channel] = new AbortController();
    return requests[channel].signal;
  }
  function identityChanged() {
    const next = options.session.snapshot().account?.uid ?? null;
    if (owner === next) return;
    owner = next;
    generation++;
    postGeneration++;
    offset = 0;
    Object.values(requests).forEach((request) => request?.abort());
    streamEpoch++;
    stream?.abort();
    stream = null;
    newPostIds.clear();
    publish({
      ...state,
      items: [],
      total: 0,
      loading: false,
      error: null,
      postId: null,
      post: null,
      postLoading: false,
      postError: null,
      newPosts: 0,
    });
  }
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  async function feed(filter: FeedFilter, append: boolean) {
    const current = ++generation;
    const signal = begin("feed");
    publish({
      ...state,
      filter,
      items: append ? state.items : [],
      total: append ? state.total : 0,
      loading: true,
      error: null,
    });
    try {
      const token =
        options.session.snapshot().status === "signedIn"
          ? await options.session.accessToken()
          : null;
      if (current !== generation) return;
      const query = new URLSearchParams({
        sort: filter.sort ?? "new",
        limit: "20",
        offset: String(append ? offset : 0),
      });
      if (filter.category) query.set("category", filter.category);
      if (filter.mangaId) query.set("mangaId", filter.mangaId);
      if (filter.authorUid) query.set("authorUid", filter.authorUid);
      const result = await api.json<{ items: ForumPost[]; total: number }>(
        `forum/posts?${query}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal },
      );
      if (current !== generation) return;
      if (!append) newPostIds.clear();
      offset = (append ? offset : 0) + result.items.length;
      const known = new Set(append ? state.items.map((post) => post.id) : []);
      publish({
        ...state,
        filter,
        items: [
          ...(append ? state.items : []),
          ...result.items.filter((post) => !known.has(post.id)),
        ],
        total: result.items.length ? result.total : offset,
        loading: false,
        newPosts: newPostIds.size,
      });
    } catch {
      if (current === generation)
        publish({
          ...state,
          loading: false,
          error: "โหลดคอมมูนิตี้ไม่สำเร็จ กรุณาลองอีกครั้ง",
        });
    }
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    activate() {
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      trendingGeneration++;
      streamEpoch++;
      stream?.abort();
      stream = null;
      generation++;
      postGeneration++;
      Object.values(requests).forEach((request) => request?.abort());
      unsubscribe?.();
      unsubscribe = undefined;
    },
    async load(filter: FeedFilter = { sort: "new" }) {
      await feed(filter, false);
    },
    async loadTrending() {
      const current = ++trendingGeneration;
      try {
        const trending = await api.json<TrendingManga[]>(
          "forum/trending-manga?limit=5",
        );
        if (current === trendingGeneration)
          publish({ ...state, trending, trendingError: null });
      } catch (error) {
        if (current === trendingGeneration)
          publish({
            ...state,
            trendingError:
              error instanceof Error
                ? error.message
                : "โหลดเรื่องยอดนิยมไม่สำเร็จ",
          });
      }
    },
    async more() {
      if (!state.loading && offset < state.total)
        await feed(state.filter, true);
    },
    async watchFeed() {
      if (stream || !unsubscribe) return;
      const current = streamEpoch,
        controller = new AbortController();
      stream = controller;
      try {
        const response = await api.request("forum/feed/stream", {
          signal: controller.signal,
        });
        for await (const event of readSse<{
          type: string;
          id: string;
          category: string;
        }>(response, controller.signal)) {
          if (current !== streamEpoch || controller.signal.aborted) break;
          if (
            event.type !== "new_post" ||
            !event.id ||
            state.items.some((post) => post.id === event.id)
          )
            continue;
          if (state.filter.category && state.filter.category !== event.category)
            continue;
          newPostIds.add(event.id);
          publish({ ...state, newPosts: newPostIds.size });
        }
      } finally {
        controller.abort();
        if (stream === controller) stream = null;
      }
    },
    stopWatching() {
      streamEpoch++;
      stream?.abort();
      stream = null;
    },
    async open(id: string) {
      const current = ++postGeneration;
      const signal = begin("post");
      publish({
        ...state,
        postId: id,
        post: null,
        postLoading: true,
        postError: null,
      });
      try {
        const token =
          options.session.snapshot().status === "signedIn"
            ? await options.session.accessToken()
            : null;
        if (current !== postGeneration) return;
        const post = await api.json<ForumPost>(
          `forum/posts/${encodeURIComponent(id)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal,
          },
        );
        if (current !== postGeneration) return;
        publish({ ...state, post, postLoading: false });
      } catch (error) {
        if (current === postGeneration)
          publish({
            ...state,
            postLoading: false,
            postError:
              error instanceof ApiError
                ? error.message
                : "เชื่อมต่อ MangaDock ไม่ได้ กรุณาลองอีกครั้ง",
          });
      }
    },
    back() {
      if (!state.postId) return false;
      postGeneration++;
      requests.post?.abort();
      publish({
        ...state,
        postId: null,
        post: null,
        postLoading: false,
        postError: null,
      });
      return true;
    },
  };
}
