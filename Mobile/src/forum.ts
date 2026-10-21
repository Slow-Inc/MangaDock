import { createApi } from "./api.ts";
import type { createMobileSession } from "./session.ts";
import type { ForumPost } from "./community.ts";
import { readSse } from "./sse.ts";
export type ForumComment = {
  id: string;
  postId: string;
  parentId: string | null;
  authorUid: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  authorRole: number;
  content: string;
  upvotes: number;
  downvotes: number;
  userVote: number;
  createdAt: string;
  updatedAt: string;
  replies?: ForumComment[];
};
export type PostDraft = {
  title: string;
  content: string;
  category: ForumPost["category"];
  targetMangaId?: string;
  targetMangaTitle?: string;
  targetMangaCover?: string;
  imageUrls?: string[];
};
function findComment(
  comments: ForumComment[],
  id: string,
): ForumComment | undefined {
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const child = findComment(comment.replies ?? [], id);
    if (child) return child;
  }
}
function mapComments(
  comments: ForumComment[],
  update: (comment: ForumComment) => ForumComment,
): ForumComment[] {
  return comments.map((comment) => ({
    ...update(comment),
    replies: mapComments(comment.replies ?? [], update),
  }));
}
export function createForum(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const api = createApi(options);
  let identity = 0,
    owner = options.session.snapshot().account?.uid ?? null;
  let state = {
    postId: null as string | null,
    post: null as ForumPost | null,
    comments: [] as ForumComment[],
    loading: false,
    error: null as string | null,
    connected: false,
  };
  const listeners = new Set<() => void>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  let view = 0,
    readGeneration = 0;
  let stream: AbortController | null = null;
  let liveCounts = new Map<string, { upvotes: number; downvotes: number }>();
  const requests = new Set<AbortController>();
  const identityChanged = () => {
    const next = options.session.snapshot().account?.uid ?? null;
    if (next !== owner) {
      owner = next;
      identity++;
      view++;
      requests.forEach((request) => request.abort());
      publish({
        postId: null,
        post: null,
        comments: [],
        loading: false,
        error: null,
        connected: false,
      });
    }
  };
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  async function request(
    path: string,
    init: RequestInit = {},
    authenticated = false,
  ) {
    const current = identity;
    const token =
      authenticated || options.session.snapshot().status === "signedIn"
        ? await options.session.accessToken()
        : null;
    if (current !== identity || !unsubscribe) return null;
    const controller = new AbortController();
    requests.add(controller);
    try {
      const response = await api.request(path, {
        ...init,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      return current === identity && !controller.signal.aborted
        ? response
        : null;
    } finally {
      requests.delete(controller);
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
    async open(id: string) {
      store.stopWatching();
      view++;
      publish({
        ...state,
        postId: id,
        post: null,
        comments: [],
        connected: false,
      });
      await store.reload();
    },
    async reload() {
      const id = state.postId,
        current = view,
        epoch = identity,
        read = ++readGeneration;
      if (!id) return;
      const countsDuringRead = new Map<
        string,
        { upvotes: number; downvotes: number }
      >();
      liveCounts = countsDuringRead;
      publish({ ...state, loading: true, error: null });
      try {
        const results = await Promise.all([
          request(`forum/posts/${encodeURIComponent(id)}`),
          request(`forum/posts/${encodeURIComponent(id)}/comments`),
        ]);
        if (results.some((result) => !result)) return;
        const [post, comments] = await Promise.all(
          results.map((result) => result!.json()),
        );
        if (current === view && epoch === identity && read === readGeneration)
          publish({
            ...state,
            post: { ...post, ...countsDuringRead.get(`post:${id}`) },
            comments: mapComments(comments, (comment) => ({
              ...comment,
              ...countsDuringRead.get(`comment:${comment.id}`),
            })),
            loading: false,
          });
      } catch (error) {
        if (current === view && epoch === identity && read === readGeneration)
          publish({
            ...state,
            loading: false,
            error:
              error instanceof Error ? error.message : "โหลดโพสต์ไม่สำเร็จ",
          });
      }
    },
    async editPost(body: { title: string; content: string }) {
      const current = view,
        epoch = identity,
        post = state.post;
      if (!post || post.authorUid !== owner)
        throw new Error("แก้ไขได้เฉพาะโพสต์ของคุณ");
      if (
        !body.title.trim() ||
        body.title.length > 200 ||
        !body.content.trim() ||
        body.content.length > 10000
      )
        throw new Error("ตรวจสอบหัวข้อและเนื้อหา");
      const result = await request(
        `forum/posts/${encodeURIComponent(post.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: body.title, content: body.content }),
        },
        true,
      );
      if (!result || current !== view || epoch !== identity) return false;
      await store.reload();
      return true;
    },
    async deletePost() {
      const current = view,
        epoch = identity,
        post = state.post;
      if (!post || post.authorUid !== owner)
        throw new Error("ลบได้เฉพาะโพสต์ของคุณ");
      const result = await request(
        `forum/posts/${encodeURIComponent(post.id)}`,
        { method: "DELETE" },
        true,
      );
      if (!result || current !== view || epoch !== identity) return false;
      readGeneration++;
      publish({
        ...state,
        post: null,
        comments: [],
        loading: false,
        error: "โพสต์นี้ถูกลบแล้ว",
      });
      return true;
    },
    async comment(content: string, parentId?: string) {
      const current = view,
        epoch = identity,
        postId = state.postId;
      if (!postId || !content.trim() || content.length > 5000)
        throw new Error("ความคิดเห็นต้องมี 1–5000 ตัวอักษร");
      if (parentId && !findComment(state.comments, parentId))
        throw new Error("ไม่พบความคิดเห็นที่ตอบกลับ");
      const result = await request(
        "forum/comments",
        {
          method: "POST",
          body: JSON.stringify({
            postId,
            content,
            ...(parentId ? { parentId } : {}),
          }),
        },
        true,
      );
      if (!result || current !== view || epoch !== identity) return false;
      await store.reload();
      return true;
    },
    async editComment(id: string, content: string) {
      const current = view,
        epoch = identity,
        comment = findComment(state.comments, id);
      if (!comment || comment.authorUid !== owner)
        throw new Error("แก้ไขได้เฉพาะความคิดเห็นของคุณ");
      if (!content.trim() || content.length > 5000)
        throw new Error("ความคิดเห็นต้องมี 1–5000 ตัวอักษร");
      const result = await request(
        `forum/comments/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify({ content }) },
        true,
      );
      if (!result || current !== view || epoch !== identity) return false;
      await store.reload();
      return true;
    },
    async deleteComment(id: string) {
      const current = view,
        epoch = identity,
        comment = findComment(state.comments, id);
      if (!comment || comment.authorUid !== owner)
        throw new Error("ลบได้เฉพาะความคิดเห็นของคุณ");
      const result = await request(
        `forum/comments/${encodeURIComponent(id)}`,
        { method: "DELETE" },
        true,
      );
      if (!result || current !== view || epoch !== identity) return false;
      await store.reload();
      return true;
    },
    async vote(
      targetType: "post" | "comment",
      targetId: string,
      voteValue: 1 | -1,
    ) {
      const current = view,
        epoch = identity;
      if (
        (targetType === "post" && targetId !== state.post?.id) ||
        (targetType === "comment" && !findComment(state.comments, targetId))
      )
        throw new Error("ไม่พบรายการที่โหวต");
      const response = await request(
        "forum/vote",
        {
          method: "POST",
          body: JSON.stringify({ targetType, targetId, voteValue }),
        },
        true,
      );
      if (!response || current !== view || epoch !== identity) return false;
      await store.reload();
      return true;
    },
    async watch() {
      if (stream || !state.postId || !unsubscribe) return;
      const id = state.postId,
        current = view,
        epoch = identity,
        controller = new AbortController();
      stream = controller;
      requests.add(controller);
      try {
        await store.reload();
        if (controller.signal.aborted || current !== view || epoch !== identity)
          return;
        const response = await api.request(
          `forum/posts/${encodeURIComponent(id)}/stream`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted || current !== view || epoch !== identity)
          return;
        publish({ ...state, connected: true });
        type Event = {
          type: string;
          postId: string;
          targetType?: string;
          targetId?: string;
          upvotes?: number;
          downvotes?: number;
          title?: string;
          content?: string;
          updatedAt?: string;
        };
        for await (const event of readSse<Event>(response, controller.signal)) {
          if (
            current !== view ||
            epoch !== identity ||
            controller.signal.aborted
          )
            break;
          if (event.postId !== id) continue;
          if (
            event.type === "vote" &&
            typeof event.upvotes === "number" &&
            typeof event.downvotes === "number"
          ) {
            const counts = {
              upvotes: event.upvotes,
              downvotes: event.downvotes,
            };
            if (
              state.loading &&
              event.targetId &&
              ["post", "comment"].includes(event.targetType ?? "")
            )
              liveCounts.set(`${event.targetType}:${event.targetId}`, counts);
            if (
              event.targetType === "post" &&
              event.targetId === id &&
              state.post
            )
              publish({ ...state, post: { ...state.post, ...counts } });
            else if (event.targetType === "comment")
              publish({
                ...state,
                comments: mapComments(state.comments, (comment) =>
                  comment.id === event.targetId
                    ? { ...comment, ...counts }
                    : comment,
                ),
              });
          } else if (
            event.type === "post_edited" &&
            state.post &&
            typeof event.title === "string" &&
            typeof event.content === "string"
          ) {
            const incoming = Date.parse(event.updatedAt ?? ""),
              accepted = Date.parse(state.post.updatedAt ?? "");
            if (!Number.isFinite(incoming) || !Number.isFinite(accepted)) {
              await store.reload();
              continue;
            }
            if (incoming <= accepted) continue;
            readGeneration++;
            publish({
              ...state,
              loading: false,
              post: {
                ...state.post,
                title: event.title,
                content: event.content,
                updatedAt: event.updatedAt,
              },
            });
          } else if (event.type === "post_deleted") {
            readGeneration++;
            publish({
              ...state,
              post: null,
              comments: [],
              loading: false,
              error: "โพสต์นี้ถูกลบแล้ว",
            });
            break;
          } else if (
            event.type === "comment" ||
            event.type === "comment_deleted"
          )
            await store.reload();
        }
      } finally {
        requests.delete(controller);
        controller.abort();
        if (stream === controller) stream = null;
        if (current === view && epoch === identity)
          publish({ ...state, connected: false });
      }
    },
    stopWatching() {
      stream?.abort();
      stream = null;
      publish({ ...state, connected: false });
    },
    async createPost(body: PostDraft): Promise<ForumPost | null> {
      if (
        !body.title.trim() ||
        body.title.length > 200 ||
        !body.content.trim() ||
        body.content.length > 10000 ||
        (body.imageUrls?.length ?? 0) > 4
      )
        throw new Error("ตรวจสอบหัวข้อ เนื้อหา และรูปประกอบสูงสุด 4 รูป");
      const current = identity,
        response = await request(
          "forum/posts",
          { method: "POST", body: JSON.stringify(body) },
          true,
        );
      if (!response) return null;
      const post = (await response.json()) as ForumPost;
      return current === identity ? post : null;
    },
    activate() {
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      store.stopWatching();
      identity++;
      view++;
      requests.forEach((request) => request.abort());
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
  return store;
}
