import { createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";
import type { ForumPost } from "./community.ts";
import { createMedia, type PickedImage } from "./media.ts";
export type FollowProfile = {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
};
export type PublicProfile = {
  profile: FollowProfile & {
    bannerUrl: string | null;
    bannerPosition: number;
    role: string | number;
    bio: string | null;
    country: string | null;
    translatorLanguages: string[];
    ratingAvg: number;
    ratingCount: number;
    createdAt: string;
  };
  posts: ForumPost[];
  comments: {
    id: string;
    postId: string;
    postTitle: string;
    content: string;
    createdAt: string;
    upvotes: number;
    downvotes: number;
  }[];
  likedPosts: ForumPost[];
  translatedTitles: {
    titleId: string;
    titleName: string;
    language: string;
    chapterCount: number;
  }[];
  earnings: {
    totalSales: number;
    totalEarned: number;
    titlesSold: number;
    uniqueBuyers: number;
  } | null;
};
export function createProfiles(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  let state = {
    uid: null as string | null,
    data: null as PublicProfile | null,
    counts: { followers: 0, following: 0 },
    followers: [] as FollowProfile[],
    following: [] as FollowProfile[],
    isFollowing: false,
    loading: false,
    error: null as string | null,
    postsLoading: false,
    hasMorePosts: false,
  };
  const listeners = new Set<() => void>();
  const api = createApi(options);
  const media = createMedia(options);
  function publish(next: typeof state) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  let generation = 0,
    owner = options.session.snapshot().account?.uid ?? null;
  let postOffset = 0;
  const requests = new Set<AbortController>();
  function reset() {
    postOffset = 0;
    generation++;
    requests.forEach((request) => request.abort());
    requests.clear();
    publish({
      ...state,
      data: null,
      followers: [],
      following: [],
      counts: { followers: 0, following: 0 },
      isFollowing: false,
      loading: false,
      error: null,
      postsLoading: false,
      hasMorePosts: false,
    });
  }
  function identityChanged() {
    const next = options.session.snapshot().account?.uid ?? null;
    if (owner !== next) {
      owner = next;
      reset();
    }
  }
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  const store = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async open(uid: string) {
      reset();
      const current = generation;
      const controller = new AbortController();
      requests.add(controller);
      const signal = controller.signal;
      publish({ ...state, uid, loading: true });
      try {
        const token =
          options.session.snapshot().status === "signedIn"
            ? await options.session.accessToken()
            : null;
        if (current !== generation) return;
        const headers = new Headers(
          token ? { Authorization: `Bearer ${token}` } : undefined,
        );
        const path = `user-follows/${encodeURIComponent(uid)}`;
        const [data, counts, followers, following, membership] =
          await Promise.all([
            api.json<PublicProfile>(
              `forum/profile/${encodeURIComponent(uid)}`,
              { headers, signal },
            ),
            api.json<typeof state.counts>(`${path}/counts`, { signal }),
            api.json<FollowProfile[]>(`${path}/followers`, { signal }),
            api.json<FollowProfile[]>(`${path}/following`, { signal }),
            token
              ? api.json<{ following: boolean }>(`${path}/is-following`, {
                  headers,
                  signal,
                })
              : { following: false },
          ]);
        if (current !== generation) return;
        postOffset = data.posts.length;
        publish({
          uid,
          data,
          counts,
          followers,
          following,
          isFollowing: membership.following,
          loading: false,
          error: null,
          postsLoading: false,
          hasMorePosts: data.posts.length >= 20,
        });
      } catch (error) {
        if (current === generation)
          publish({
            ...state,
            loading: false,
            error:
              error instanceof Error ? error.message : "โหลดโปรไฟล์ไม่สำเร็จ",
          });
      } finally {
        requests.delete(controller);
      }
    },
    async follow(enabled: boolean) {
      const uid = state.uid;
      const current = generation;
      if (!uid || options.session.snapshot().status !== "signedIn")
        throw new Error("กรุณาเข้าสู่ระบบก่อนติดตาม");
      if (uid === options.session.snapshot().account?.uid) return false;
      const token = await options.session.accessToken();
      if (current !== generation) return false;
      const controller = new AbortController();
      requests.add(controller);
      try {
        await api.request(`user-follows/${encodeURIComponent(uid)}/follow`, {
          method: enabled ? "POST" : "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
      } finally {
        requests.delete(controller);
      }
      if (current !== generation) return false;
      await store.open(uid);
      return true;
    },
    async morePosts() {
      const current = generation,
        uid = state.uid;
      if (!uid || !state.data || !state.hasMorePosts || state.postsLoading)
        return;
      const controller = new AbortController();
      requests.add(controller);
      publish({ ...state, postsLoading: true, error: null });
      try {
        const token =
          options.session.snapshot().status === "signedIn"
            ? await options.session.accessToken()
            : null;
        if (current !== generation) return;
        const query = new URLSearchParams({
          authorUid: uid,
          sort: "new",
          limit: "20",
          offset: String(postOffset),
        });
        const result = await api.json<{ items: ForumPost[]; total: number }>(
          `forum/posts?${query}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          },
        );
        if (current !== generation || !state.data) return;
        postOffset += result.items.length;
        const known = new Set(state.data.posts.map((post) => post.id));
        publish({
          ...state,
          data: {
            ...state.data,
            posts: [
              ...state.data.posts,
              ...result.items.filter((post) => !known.has(post.id)),
            ],
          },
          postsLoading: false,
          hasMorePosts: result.items.length > 0 && postOffset < result.total,
        });
      } catch (error) {
        if (current === generation)
          publish({
            ...state,
            postsLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "โหลดโพสต์เพิ่มไม่สำเร็จ",
          });
      } finally {
        requests.delete(controller);
      }
    },
    async uploadBanner(image: PickedImage) {
      const current = generation,
        uid = state.uid;
      if (!uid || uid !== owner) throw new Error("แก้ไขได้เฉพาะโปรไฟล์ของคุณ");
      const result = await media.upload<{ bannerUrl: string }>(
        "forum/profile/banner",
        image,
      );
      if (!result || current !== generation) return false;
      await store.open(uid);
      return true;
    },
    async positionBanner(position: number) {
      const current = generation,
        uid = state.uid;
      if (!uid || uid !== owner) throw new Error("แก้ไขได้เฉพาะโปรไฟล์ของคุณ");
      if (!Number.isFinite(position) || position < 0 || position > 100)
        throw new Error("ตำแหน่งต้องอยู่ระหว่าง 0–100");
      const token = await options.session.accessToken();
      if (current !== generation || !unsubscribe) return false;
      const controller = new AbortController();
      requests.add(controller);
      try {
        await api.request("forum/profile/banner-position", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ position: Math.round(position * 100) / 100 }),
          signal: controller.signal,
        });
      } finally {
        requests.delete(controller);
      }
      if (current !== generation) return false;
      await store.open(uid);
      return true;
    },
    activate() {
      media.activate();
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    close() {
      reset();
      publish({ ...state, uid: null });
    },
    dispose() {
      media.dispose();
      reset();
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
  return store;
}
