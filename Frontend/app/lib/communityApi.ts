import { supabase } from "./supabase";
import type { ForumPost, ForumComment, ForumCategory, UserProfileResponse } from "./types";
import { cacheOrFetch, cacheInvalidate, cacheClearByTag, TTL } from "./apiCache";
import { createAuthHeaders } from "./apiUtils";

const API_BASE = "/api/proxy";

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function listPosts(options: {
  category?: ForumCategory;
  mangaId?: string;
  sort?: 'new' | 'hot';
  offset?: number;
  limit?: number;
} = {}) {
  const { category, mangaId, sort = 'hot', offset = 0, limit = 20 } = options;
  const cacheKey = `posts:${category ?? ''}:${mangaId ?? ''}:${sort}:${offset}:${limit}`;

  return cacheOrFetch(
    cacheKey,
    async () => {
      const token = await getAuthToken();
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (mangaId) params.append('mangaId', mangaId);
      params.append('sort', sort);
      if (offset) params.append('offset', offset.toString());
      params.append('limit', limit.toString());
      const res = await fetch(`${API_BASE}/forum/posts?${params.toString()}`, {
        headers: createAuthHeaders(token),
      });
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json() as Promise<{ items: ForumPost[]; total: number }>;
    },
    TTL.SHORT,
    { staleAfter: 40_000, tags: ['forum_posts'] },
  );
}

export async function listPostsByUser(
  uid: string,
  offset: number,
  limit = 20,
): Promise<{ items: ForumPost[]; total: number }> {
  const token = await getAuthToken();
  const params = new URLSearchParams({
    authorUid: uid,
    offset: offset.toString(),
    limit: limit.toString(),
    sort: 'new',
  });
  const res = await fetch(`${API_BASE}/forum/posts?${params.toString()}`, {
    headers: createAuthHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch user posts');
  return res.json() as Promise<{ items: ForumPost[]; total: number }>;
}

export interface TrendingManga {
  mangaId: string;
  mangaTitle: string;
  mangaCover: string | null;
  postCount: number;
}

export async function getTrendingManga(limit = 5) {
  return cacheOrFetch(
    `trending:${limit}`,
    async () => {
      const res = await fetch(`${API_BASE}/forum/trending-manga?limit=${limit}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Failed to fetch trending manga: ${res.status} ${errText}`);
      }
      return res.json() as Promise<TrendingManga[]>;
    },
    TTL.MEDIUM,
    { staleAfter: 4 * 60_000, tags: ['trending'] },
  );
}

export async function getPost(id: string) {
  return cacheOrFetch(
    `post:${id}`,
    async () => {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/forum/posts/${id}`, {
        headers: createAuthHeaders(token),
      });
      if (!res.ok) throw new Error("Post not found");
      return res.json() as Promise<ForumPost>;
    },
    TTL.SHORT,
    { staleAfter: 40_000, tags: [`forum_post:${id}`] },
  );
}

export async function uploadForumImage(file: File): Promise<{ imageUrl: string }> {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/forum/upload-image`, {
    method: 'POST',
    headers: createAuthHeaders(token),
    body: formData,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${errText}`);
  }
  return res.json() as Promise<{ imageUrl: string }>;
}

export async function createPost(data: {
  title: string;
  content: string;
  category: ForumCategory;
  targetMangaId?: string;
  targetMangaTitle?: string;
  targetMangaCover?: string;
  imageUrls?: string[];
}) {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/posts`, {
    method: "POST",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Failed to create post: ${res.status} ${errText}`);
  }
  const post = await res.json() as ForumPost;
  cacheClearByTag('forum_posts');
  return post;
}

export async function listComments(postId: string) {
  return cacheOrFetch(
    `comments:${postId}`,
    async () => {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/forum/posts/${postId}/comments`, {
        headers: createAuthHeaders(token),
      });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json() as Promise<ForumComment[]>;
    },
    TTL.SHORT,
    { staleAfter: 40_000, tags: [`forum_post:${postId}`] },
  );
}

export async function createComment(data: {
  postId: string;
  parentId?: string;
  content: string;
}) {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/comments`, {
    method: "POST",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create comment");
  const comment = await res.json() as ForumComment;
  cacheInvalidate(`comments:${data.postId}`);
  return comment;
}

export async function uploadProfileBanner(file: File): Promise<{ bannerUrl: string }> {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/forum/profile/banner`, {
    method: "POST",
    headers: createAuthHeaders(token),
    body: formData,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Banner upload failed: ${res.status} ${errText}`);
  }
  return res.json() as Promise<{ bannerUrl: string }>;
}

export async function updateBannerPosition(position: number): Promise<{ bannerPosition: number }> {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/profile/banner-position`, {
    method: "PATCH",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ position: Math.round(position * 100) / 100 }),
  });
  if (!res.ok) throw new Error("Failed to update banner position");
  return res.json() as Promise<{ bannerPosition: number }>;
}

export async function getProfile(uid: string): Promise<UserProfileResponse> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/forum/profile/${uid}`, {
    headers: createAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Profile not found");
  return res.json() as Promise<UserProfileResponse>;
}

export async function deletePost(id: string): Promise<void> {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/posts/${id}`, {
    method: "DELETE",
    headers: createAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete post");
  cacheInvalidate(`post:${id}`, `comments:${id}`);
  cacheClearByTag('forum_posts');
}

export async function deleteComment(id: string, postId?: string): Promise<void> {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/comments/${id}`, {
    method: "DELETE",
    headers: createAuthHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete comment");
  if (postId) cacheInvalidate(`comments:${postId}`);
}

export async function updatePost(id: string, data: { title?: string; content?: string }) {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/posts/${id}`, {
    method: "PATCH",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update post");
  const post = await res.json() as ForumPost;
  cacheInvalidate(`post:${id}`);
  cacheClearByTag('forum_posts');
  return post;
}

export async function updateComment(id: string, data: { content: string }) {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/comments/${id}`, {
    method: "PATCH",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update comment");
  const comment = await res.json() as ForumComment;
  cacheInvalidate(`comments:${comment.postId}`);
  return comment;
}

export async function vote(data: {
  targetType: 'post' | 'comment';
  targetId: string;
  voteValue: 1 | -1;
}) {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/vote`, {
    method: "POST",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to vote");
  return res.json() as Promise<{ upvotes: number; downvotes: number }>;
}
