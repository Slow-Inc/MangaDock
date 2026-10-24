import { createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";
import type { CommentContext } from "./reading-social.ts";
export function createTranslationFeedback(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const api = createApi(options);
  let generation = 0,
    owner = options.session.snapshot().account?.uid ?? null;
  let state = {
    context: null as CommentContext | null,
    vote: null as 1 | -1 | null,
    loading: false,
    busy: false,
    error: null as string | null,
  };
  const listeners = new Set<() => void>(),
    requests = new Set<AbortController>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  let pending: Promise<boolean> | null = null;
  const identityChanged = () => {
    const next = options.session.snapshot().account?.uid ?? null;
    if (next !== owner) {
      owner = next;
      generation++;
      pending = null;
      requests.forEach((request) => request.abort());
      publish({
        context: null,
        vote: null,
        loading: false,
        busy: false,
        error: null,
      });
    }
  };
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  function query(context: CommentContext) {
    return new URLSearchParams({
      mangaId: context.mangaId,
      chapterId: context.chapterId,
      page: String(context.pageNumber),
    });
  }
  async function request(path: string, init: RequestInit, current: number) {
    const token = await options.session.accessToken();
    if (current !== generation || !unsubscribe) return null;
    const controller = new AbortController();
    requests.add(controller);
    try {
      const response = await api.request(path, {
        ...init,
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      return current === generation && !controller.signal.aborted
        ? response
        : null;
    } finally {
      requests.delete(controller);
    }
  }
  async function load(context: CommentContext, current: number) {
    const response = await request(
      `translation-feedback/my?${query(context)}`,
      {},
      current,
    );
    if (!response) return;
    const result = (await response.json()) as {
      pageNumber: number;
      vote: 1 | -1;
    } | null;
    if (current !== generation) return;
    if (
      result &&
      (result.pageNumber !== context.pageNumber ||
        ![1, -1].includes(result.vote))
    )
      throw new Error("ข้อมูลโหวตไม่ตรงกับหน้าที่อ่าน");
    publish({ ...state, vote: result?.vote ?? null, loading: false });
  }
  const store = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async select(context: CommentContext) {
      const current = ++generation;
      pending = null;
      requests.forEach((request) => request.abort());
      publish({
        context,
        vote: null,
        loading: options.session.snapshot().status === "signedIn",
        busy: false,
        error: null,
      });
      if (options.session.snapshot().status !== "signedIn") return;
      try {
        await load(context, current);
      } catch (error) {
        if (current === generation)
          publish({
            ...state,
            loading: false,
            error: error instanceof Error ? error.message : "โหลดโหวตไม่สำเร็จ",
          });
      }
    },
    vote(vote: 1 | -1): Promise<boolean> {
      if (pending) return pending;
      const current = generation,
        context = state.context;
      if (!context || state.loading)
        return Promise.reject(new Error("รอโหลดโหวตของหน้านี้ก่อน"));
      const previous = state.vote;
      publish({ ...state, busy: true, error: null });
      const promise = (async () => {
        const response = await request(
          previous === vote
            ? `translation-feedback?${query(context)}`
            : "translation-feedback",
          {
            method: previous === vote ? "DELETE" : "POST",
            ...(previous === vote
              ? {}
              : { body: JSON.stringify({ ...context, vote }) }),
          },
          current,
        );
        if (!response || current !== generation) return false;
        await load(context, current);
        return current === generation;
      })()
        .catch((error) => {
          if (current !== generation) return false;
          throw error;
        })
        .finally(() => {
          if (pending === promise) pending = null;
          if (current === generation) publish({ ...state, busy: false });
        });
      pending = promise;
      return promise;
    },
    activate() {
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      generation++;
      pending = null;
      requests.forEach((request) => request.abort());
      unsubscribe?.();
      unsubscribe = undefined;
      publish({
        context: null,
        vote: null,
        loading: false,
        busy: false,
        error: null,
      });
    },
  };
  return store;
}
