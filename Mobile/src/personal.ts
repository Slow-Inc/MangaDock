import { createApi } from "./api.ts";
import type { Book, BookDetail } from "./catalog.ts";
import type { createMobileSession } from "./session.ts";

export type LibraryTab = "favorites" | "follows" | "liked" | "history";
export type HistoryBook = Book & {
  lastReadAt: number;
  lastChapterId?: string | null;
  lastPage?: number | null;
};
export function createPersonal(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const api = createApi(options);
  let state: {
    tab: LibraryTab;
    items: Book[];
    history: HistoryBook[];
    loading: boolean;
    error: string | null;
    loginRequired: boolean;
    membership: {
      id: string | null;
      favorites: boolean;
      follows: boolean;
      liked: boolean;
      loading: boolean;
      error: string | null;
    };
  } = {
    tab: "favorites",
    items: [],
    history: [],
    loading: false,
    error: null,
    loginRequired: options.session.snapshot().status !== "signedIn",
    membership: {
      id: null,
      favorites: false,
      follows: false,
      liked: false,
      loading: false,
      error: null,
    },
  };
  const listeners = new Set<() => void>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  let generation = 0;
  let identity = 0;
  let membershipGeneration = 0;
  let membershipRequest: AbortController | null = null;
  let progressQueue: Promise<unknown> = Promise.resolve();
  let historyRevision = 0;
  let collectionRevision = 0;
  const collectionWrites = new Map<
    string,
    {
      revision: number;
      tab: Exclude<LibraryTab, "history">;
      book: Book;
      enabled: boolean;
    }
  >();
  const acknowledged = new Map<
    string,
    { revision: number; item: HistoryBook }
  >();
  const progressRequests = new Set<AbortController>();
  let owner = options.session.snapshot().account?.uid ?? null;
  let request: AbortController | null = null;
  function identityChanged() {
    const next = options.session.snapshot().account?.uid ?? null;
    if (next === owner) return;
    owner = next;
    generation++;
    identity++;
    membershipGeneration++;
    membershipRequest?.abort();
    request?.abort();
    progressRequests.forEach((controller) => controller.abort());
    progressQueue = Promise.resolve();
    acknowledged.clear();
    collectionWrites.clear();
    publish({
      ...state,
      items: [],
      history: [],
      loading: false,
      error: null,
      loginRequired: !owner,
      membership: {
        id: null,
        favorites: false,
        follows: false,
        liked: false,
        loading: false,
        error: null,
      },
    });
  }
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  function write(
    path: string,
    init: RequestInit,
    committed: () => void,
  ): Promise<boolean> {
    const current = identity;
    const saving = progressQueue.then(async () => {
      if (!owner || current !== identity) return false;
      const token =
        options.session.snapshot().status === "signedIn"
          ? await options.session.accessToken()
          : null;
      if (!token || current !== identity) return false;
      const controller = new AbortController();
      progressRequests.add(controller);
      try {
        await api.request(path, {
          ...init,
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (current !== identity) return false;
        committed();
        return true;
      } catch (error) {
        if (current !== identity) return false;
        throw error;
      } finally {
        progressRequests.delete(controller);
      }
    });
    progressQueue = saving.catch(() => {});
    return saving;
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
      generation++;
      identity++;
      membershipGeneration++;
      membershipRequest?.abort();
      request?.abort();
      progressRequests.forEach((controller) => controller.abort());
      unsubscribe?.();
      unsubscribe = undefined;
    },
    recordProgress(item: HistoryBook): Promise<boolean> {
      return write(
        "users/me/history",
        { method: "POST", body: JSON.stringify(item) },
        () => {
          acknowledged.set(item.id, { revision: ++historyRevision, item });
          const history = [
            item,
            ...state.history.filter((book) => book.id !== item.id),
          ];
          publish({
            ...state,
            history,
            ...(state.tab === "history" ? { items: history } : {}),
          });
        },
      );
    },
    setCollection(
      tab: Exclude<LibraryTab, "history">,
      book: Book,
      enabled: boolean,
    ) {
      const path = `users/me/${tab}${enabled && tab !== "liked" ? "" : `/${encodeURIComponent(book.id)}`}`;
      return write(
        path,
        {
          method: enabled ? "POST" : "DELETE",
          ...(enabled && tab !== "liked" ? { body: JSON.stringify(book) } : {}),
        },
        () => {
          collectionWrites.set(`${tab}/${book.id}`, {
            revision: ++collectionRevision,
            tab,
            book,
            enabled,
          });
          publish({
            ...state,
            ...(state.tab === tab
              ? {
                  items: enabled
                    ? [
                        book,
                        ...state.items.filter((item) => item.id !== book.id),
                      ]
                    : state.items.filter((item) => item.id !== book.id),
                }
              : {}),
            ...(state.membership.id === book.id
              ? { membership: { ...state.membership, [tab]: enabled } }
              : {}),
          });
        },
      );
    },
    removeHistory(id?: string) {
      return write(
        `users/me/history${id ? `/${encodeURIComponent(id)}` : ""}`,
        { method: "DELETE" },
        () => {
          if (id) acknowledged.delete(id);
          else acknowledged.clear();
          if (state.tab === "history") {
            generation++;
            request?.abort();
          }
          const history = id
            ? state.history.filter((book) => book.id !== id)
            : [];
          publish({
            ...state,
            history,
            ...(state.tab === "history"
              ? { items: history, loading: false }
              : {}),
          });
        },
      );
    },
    async exportHistory(): Promise<string | null> {
      const current = identity;
      if (!owner) return null;
      const token = await options.session.accessToken();
      if (current !== identity) return null;
      const controller = new AbortController();
      progressRequests.add(controller);
      try {
        const csv = await (
          await api.request("users/me/history/export", {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
        ).text();
        return current === identity ? csv : null;
      } catch (error) {
        if (current !== identity) return null;
        throw error;
      } finally {
        progressRequests.delete(controller);
      }
    },
    async loadMembership(id: string) {
      const current = ++membershipGeneration;
      const startedRevision = collectionRevision;
      membershipRequest?.abort();
      membershipRequest = new AbortController();
      const signal = membershipRequest.signal;
      publish({
        ...state,
        membership: {
          id,
          favorites: false,
          follows: false,
          liked: false,
          loading: !!owner,
          error: null,
        },
      });
      if (!owner) return;
      try {
        const token = await options.session.accessToken();
        if (current !== membershipGeneration) return;
        const headers = { Authorization: `Bearer ${token}` };
        const [favorites, follows, liked] = await Promise.all([
          api.json<Book[]>("users/me/favorites", { headers, signal }),
          api.json<Book[]>("users/me/follows", { headers, signal }),
          api.json<string[]>("users/me/liked", { headers, signal }),
        ]);
        if (current === membershipGeneration) {
          const membership = {
            id,
            favorites: favorites.some((book) => book.id === id),
            follows: follows.some((book) => book.id === id),
            liked: liked.includes(id),
            loading: false,
            error: null,
          };
          for (const change of collectionWrites.values())
            if (change.book.id === id && change.revision > startedRevision)
              membership[change.tab] = change.enabled;
          publish({ ...state, membership });
        }
      } catch {
        if (current === membershipGeneration)
          publish({
            ...state,
            membership: {
              ...state.membership,
              loading: false,
              error: "โหลดสถานะรายการไม่สำเร็จ กรุณาลองอีกครั้ง",
            },
          });
      }
    },
    async load(tab: LibraryTab) {
      const current = ++generation;
      const startedRevision = historyRevision;
      const startedCollectionRevision = collectionRevision;
      request?.abort();
      request = new AbortController();
      const signal = request.signal;
      publish({ ...state, tab, items: [], loading: true, error: null });
      try {
        const token =
          options.session.snapshot().status === "signedIn"
            ? await options.session.accessToken()
            : null;
        if (current !== generation) return;
        if (!token) {
          publish({
            ...state,
            tab,
            items: [],
            loading: false,
            loginRequired: true,
          });
          return;
        }
        publish({
          ...state,
          tab,
          loading: true,
          error: null,
          loginRequired: false,
        });
        let items: Book[];
        if (tab === "liked") {
          const ids = await api.json<string[]>("users/me/liked", {
            headers: { Authorization: `Bearer ${token}` },
            signal,
          });
          items = [];
          for (let offset = 0; offset < ids.length; offset += 4) {
            if (current !== generation) return;
            const books = await Promise.all(
              ids
                .slice(offset, offset + 4)
                .map((id) =>
                  api.json<BookDetail>(
                    `books/manga/${encodeURIComponent(id)}`,
                    { signal },
                  ),
                ),
            );
            items.push(
              ...books.map((book) => ({
                id: book.id,
                title: book.title ?? "",
                thumbnail: book.covers[0]?.url ?? "",
                authors: book.authors,
                description: book.description,
                categories: book.genres,
              })),
            );
          }
        } else
          items = await api.json<HistoryBook[]>(`users/me/${tab}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal,
          });
        if (current !== generation) return;
        if (tab !== "history") {
          const changes = [...collectionWrites.values()].filter(
            (change) =>
              change.tab === tab && change.revision > startedCollectionRevision,
          );
          const ids = new Set(changes.map((change) => change.book.id));
          items = [
            ...changes
              .filter((change) => change.enabled)
              .map((change) => change.book),
            ...items.filter((book) => !ids.has(book.id)),
          ];
        }
        if (tab === "history") {
          const newer = [...acknowledged.values()]
            .filter((entry) => entry.revision > startedRevision)
            .map((entry) => entry.item);
          const ids = new Set(newer.map((book) => book.id));
          items = [...newer, ...items.filter((book) => !ids.has(book.id))].sort(
            (a, b) =>
              (b as HistoryBook).lastReadAt - (a as HistoryBook).lastReadAt,
          );
        }
        publish({
          ...state,
          items,
          ...(tab === "history" ? { history: items as HistoryBook[] } : {}),
          loading: false,
        });
      } catch {
        if (current === generation)
          publish({
            ...state,
            items: [],
            loading: false,
            error: "โหลดรายการของคุณไม่สำเร็จ กรุณาลองอีกครั้ง",
          });
      }
    },
  };
}
