import { supabase } from "./supabase";
import type { ForumPost, ForumComment, ForumCategory } from "./types";

const API_BASE = "/api/proxy";

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function authHeaders(token: string | null, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function listPosts(options: {
  category?: ForumCategory;
  mangaId?: string;
  sort?: 'new' | 'hot';
  offset?: number;
  limit?: number;
} = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  if (options.category) params.append('category', options.category);
  if (options.mangaId) params.append('mangaId', options.mangaId);
  if (options.sort) params.append('sort', options.sort);
  if (options.offset) params.append('offset', options.offset.toString());
  if (options.limit) params.append('limit', options.limit.toString());

  const res = await fetch(`${API_BASE}/forum/posts?${params.toString()}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json() as Promise<{ items: ForumPost[]; total: number }>;
}

export async function getPost(id: string) {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/forum/posts/${id}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Post not found");
  return res.json() as Promise<ForumPost>;
}

export async function createPost(data: {
  title: string;
  content: string;
  category: ForumCategory;
  targetMangaId?: string;
}) {
  const token = await getAuthToken();
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(`${API_BASE}/forum/posts`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create post");
  return res.json() as Promise<ForumPost>;
}

export async function listComments(postId: string) {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/forum/posts/${postId}/comments`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json() as Promise<ForumComment[]>;
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
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create comment");
  return res.json() as Promise<ForumComment>;
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
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to vote");
  return res.json() as Promise<{ upvotes: number; downvotes: number }>;
}
