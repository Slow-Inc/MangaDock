import { ApiError, createApi } from "./api.ts";
import type { Book } from "./catalog.ts";
import type { ForumPost } from "./community.ts";
import type { createMobileSession } from "./session.ts";

export type ReadingCollection = {
  id: string;
  owner_uid: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  created_at: string;
  updated_at: string;
};
export type CollectionDetail = ReadingCollection & {
  items: { manga_id: string; title: string; added_at: string }[];
};
export type CollectionInput = Pick<
  ReadingCollection,
  "name" | "description" | "visibility"
>;
export type FeedMode = "following" | "personalized";

export function createRetention(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const api = createApi(options);
  const initial = () => ({
    collections: [] as ReadingCollection[],
    listLoading: false,
    listError: null as string | null,
    id: null as string | null,
    detail: null as CollectionDetail | null,
    detailLoading: false,
    detailError: null as string | null,
    saving: false,
    mutationError: null as string | null,
    results: [] as Book[],
    searching: false,
    searchError: null as string | null,
    feed: {
      mode: "following" as FeedMode,
      items: [] as ForumPost[],
      total: 0,
      offset: 0,
      loading: false,
      error: null as string | null,
    },
  });
  let state = initial();
  let owner = options.session.snapshot().account?.uid ?? null;
  let identity = 0;
  let view = 0;
  const listeners = new Set<() => void>();
  const requests = new Map<string, AbortController>();
  const revisions = new Map<string, number>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  function cancel(channel: string) {
    revisions.set(channel, (revisions.get(channel) ?? 0) + 1);
    requests.get(channel)?.abort();
    requests.delete(channel);
  }
  function resetIdentity() {
    const next = options.session.snapshot().account?.uid ?? null;
    if (next === owner) return;
    owner = next;
    identity++;
    view++;
    requests.forEach((controller) => controller.abort());
    requests.clear();
    publish(initial());
  }
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(resetIdentity);
  function begin(channel: string) {
    cancel(channel);
    const controller = new AbortController();
    requests.set(channel, controller);
    const epoch = identity;
    const revision = revisions.get(channel);
    return {
      current: () => epoch === identity && revision === revisions.get(channel),
      async read<T>(
        path: string,
        init: RequestInit = {},
        authenticated = true,
      ): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let onAbort = () => {};
        try {
          return await Promise.race([
            (async () => {
              const headers = new Headers(init.headers);
              if (authenticated) {
                if (!owner || options.session.snapshot().status !== "signedIn")
                  throw new ApiError(401, "กรุณาเข้าสู่ระบบเพื่อใช้รายการนี้");
                const token = await options.session.accessToken();
                if (!token || epoch !== identity || controller.signal.aborted)
                  throw new ApiError(401, "บัญชีเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
                headers.set("Authorization", `Bearer ${token}`);
              }
              const response = await api.request(path, {
                ...init,
                headers,
                cache: "no-store",
                signal: controller.signal,
              });
              return response.status === 204
                ? (undefined as T)
                : ((await response.json()) as T);
            })(),
            new Promise<never>((_resolve, reject) => {
              onAbort = () => reject(new Error("การเชื่อมต่อถูกยกเลิก"));
              controller.signal.addEventListener("abort", onAbort, {
                once: true,
              });
              timer = setTimeout(() => {
                reject(new Error("การเชื่อมต่อใช้เวลานาน กรุณาลองอีกครั้ง"));
                // Settle the deadline first so the visible error describes the timeout.
                controller.abort();
              }, 15_000);
              if (controller.signal.aborted) onAbort();
            }),
          ]);
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener("abort", onAbort);
          if (requests.get(channel) === controller) requests.delete(channel);
        }
      },
    };
  }
  const message = (error: unknown) =>
    error instanceof Error
      ? error.message
      : "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง";
  // A timeout aborts its transport but must still publish an error for this view.
  async function loadList() {
    const operation = begin("list");
    publish({ ...state, listLoading: true, listError: null });
    try {
      const collections =
        await operation.read<ReadingCollection[]>("collections");
      if (operation.current())
        publish({ ...state, collections, listLoading: false });
    } catch (error) {
      if (operation.current())
        publish({ ...state, listLoading: false, listError: message(error) });
    }
  }
  async function open(id: string) {
    const currentView = ++view;
    cancel("write");
    cancel("search");
    const operation = begin("detail");
    publish({
      ...state,
      id,
      detail: null,
      detailLoading: true,
      detailError: null,
      saving: false,
      mutationError: null,
      results: [],
      searching: false,
      searchError: null,
    });
    try {
      const detail = await operation.read<CollectionDetail>(
        `collections/${owner ? "" : "public/"}${encodeURIComponent(id)}`,
        {},
        !!owner,
      );
      if (operation.current() && view === currentView)
        publish({ ...state, detail, detailLoading: false });
    } catch (error) {
      if (operation.current() && view === currentView)
        publish({
          ...state,
          detailLoading: false,
          detailError: message(error),
        });
    }
  }
  async function write<T>(
    path: string,
    init: RequestInit,
    committed: (result: T) => void,
  ) {
    if (state.saving) return false;
    const currentView = view;
    const operation = begin("write");
    publish({ ...state, saving: true, mutationError: null });
    try {
      const result = await operation.read<T>(path, init);
      if (!operation.current() || view !== currentView) return false;
      committed(result);
      publish({ ...state, saving: false });
      return true;
    } catch (error) {
      if (operation.current() && view === currentView)
        publish({ ...state, saving: false, mutationError: message(error) });
      return false;
    }
  }
  async function feed(mode: FeedMode = state.feed.mode, more = false) {
    if (more && (state.feed.loading || state.feed.offset >= state.feed.total))
      return;
    const operation = begin("feed");
    const offset = more && mode === state.feed.mode ? state.feed.offset : 0;
    publish({
      ...state,
      feed: {
        ...state.feed,
        mode,
        loading: true,
        error: null,
        ...(offset === 0 ? { items: [], offset: 0, total: 0 } : {}),
      },
    });
    try {
      const result = await operation.read<{
        items: ForumPost[];
        total: number;
      }>(`feed?mode=${mode}&offset=${offset}&limit=20`);
      if (!operation.current()) return;
      const items = new Map(
        (offset ? state.feed.items : []).map((post) => [post.id, post]),
      );
      result.items.forEach((post) => items.set(post.id, post));
      publish({
        ...state,
        feed: {
          mode,
          items: [...items.values()],
          loading: false,
          error: null,
          offset: offset + result.items.length,
          total: result.items.length ? result.total : offset,
        },
      });
    } catch (error) {
      if (operation.current())
        publish({
          ...state,
          feed: { ...state.feed, loading: false, error: message(error) },
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
      resetIdentity();
      unsubscribe ??= options.session.subscribe(resetIdentity);
    },
    dispose() {
      identity++;
      view++;
      requests.forEach((controller) => controller.abort());
      requests.clear();
      unsubscribe?.();
      unsubscribe = undefined;
    },
    list: loadList,
    open,
    back() {
      if (!state.id) return false;
      view++;
      for (const channel of ["detail", "write", "search"]) cancel(channel);
      publish({
        ...state,
        id: null,
        detail: null,
        detailLoading: false,
        detailError: null,
        saving: false,
        mutationError: null,
        results: [],
        searching: false,
        searchError: null,
      });
      return true;
    },
    save(input: CollectionInput, id?: string) {
      const name = input.name.trim();
      if (!name || name.length > 100 || input.description.length > 1000) {
        publish({
          ...state,
          mutationError:
            "กรอกชื่อ 1–100 ตัวอักษร และคำอธิบายไม่เกิน 1,000 ตัวอักษร",
        });
        return Promise.resolve(false);
      }
      return write<ReadingCollection>(
        `collections${id ? `/${encodeURIComponent(id)}` : ""}`,
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify({ ...input, name }),
        },
        (saved) => {
          cancel("list");
          cancel("detail");
          state = {
            ...state,
            collections: [
              saved,
              ...state.collections.filter((item) => item.id !== saved.id),
            ],
            listLoading: false,
            id: saved.id,
            detailLoading: false,
            detailError: null,
            detail: {
              ...saved,
              items:
                (id && id === state.detail?.id
                  ? state.detail?.items
                  : undefined) ?? [],
            },
          };
        },
      );
    },
    remove() {
      const id = state.detail?.id;
      if (!id) return Promise.resolve(false);
      return write<void>(
        `collections/${encodeURIComponent(id)}`,
        { method: "DELETE" },
        () => {
          cancel("list");
          state = {
            ...state,
            collections: state.collections.filter((item) => item.id !== id),
            listLoading: false,
            id: null,
            detail: null,
          };
        },
      );
    },
    item(book: Pick<Book, "id" | "title">, remove = false) {
      const detail = state.detail;
      if (!detail) return Promise.resolve(false);
      return write<void>(
        `collections/${encodeURIComponent(detail.id)}/items`,
        {
          method: remove ? "DELETE" : "PUT",
          body: JSON.stringify({ mangaId: book.id, title: book.title }),
        },
        () => {
          const items = detail.items.filter(
            (item) => item.manga_id !== book.id,
          );
          if (!remove)
            items.push({
              manga_id: book.id,
              title: book.title,
              added_at: new Date().toISOString(),
            });
          state = { ...state, detail: { ...detail, items } };
        },
      );
    },
    async search(query: string) {
      const currentView = view;
      const operation = begin("search");
      publish({ ...state, results: [], searching: true, searchError: null });
      try {
        const result = await operation.read<{ items: Book[] }>(
          `books/search?q=${encodeURIComponent(query.trim())}&limit=20&offset=0`,
          {},
          false,
        );
        if (operation.current() && view === currentView)
          publish({ ...state, results: result.items, searching: false });
      } catch (error) {
        if (operation.current() && view === currentView)
          publish({ ...state, searching: false, searchError: message(error) });
      }
    },
    feed,
  };
}
