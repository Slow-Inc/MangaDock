"use client";

const API_BASE = "/api/proxy";

export type StudioBook = {
  id: string;
  title: string;
  subtitle: string;
  thumbnail?: string;
  authors?: string[];
};

export type StudioChapter = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
  translatedLanguage: string;
  uploadedAt: string;
  pageCount: number;
};

export type VersionStatus = "draft" | "pending_moderation" | "published" | "rejected";

export type ChapterVersion = {
  versionId: string;
  titleId: string;
  titleName: string;
  titleAltName?: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  translatorUid: string;
  translatorName: string | null;
  status: VersionStatus;
  pages: string[];
  priceCoins: number;
  qualityScore: number;
  isDefault: boolean;
  description: string | null;
};

export type CreateVersionInput = {
  titleId: string;
  titleName: string;
  titleAltName?: string;
  chapterId?: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  description?: string;
  priceCoins?: number;
};

type UploadPageResult = { pageUrl: string; pageIndex: number };

function normalizeProxyUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/api/proxy/")) return url;
  if (url.startsWith("/")) return `/api/proxy${url}`;
  return url;
}

async function parseErrorMessage(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const json = JSON.parse(body) as { message?: string | string[]; error?: string };
    if (Array.isArray(json?.message)) return json.message.join(", ");
    if (typeof json?.message === "string") return json.message;
    if (typeof json?.error === "string") return json.error;
  } catch {
    // ignore parse error
  }
  return body || `HTTP ${res.status}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function authHeaders(token: string, extra?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    ...(extra ?? {}),
  };
}

export async function searchBooks(query: string): Promise<{ items: StudioBook[]; total: number }> {
  const qs = new URLSearchParams({ q: query, limit: "20", offset: "0" });
  const data = await apiFetch<{ items: Array<{ id: string; title: string; subtitle: string; thumbnail?: string; authors?: string[] }>; total: number }>(
    `/books/search?${qs.toString()}`,
  );
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map((b) => ({
      id: b.id,
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      thumbnail: b.thumbnail,
      authors: b.authors ?? [],
    })),
  };
}

export function getBookCoverUrl(bookId: string): string {
  return `${API_BASE}/books/manga/${encodeURIComponent(bookId)}/preview`;
}

export async function getBookChapters(bookId: string): Promise<StudioChapter[]> {
  return apiFetch<StudioChapter[]>(`/books/manga/${encodeURIComponent(bookId)}/chapters`);
}

export async function getMyVersions(token: string): Promise<ChapterVersion[]> {
  return apiFetch<ChapterVersion[]>("/versions/me/versions", {
    headers: authHeaders(token),
  });
}

export async function getVersion(token: string, versionId: string): Promise<ChapterVersion> {
  return apiFetch<ChapterVersion>(`/versions/${encodeURIComponent(versionId)}`, {
    headers: authHeaders(token),
  });
}

export async function createVersion(token: string, payload: CreateVersionInput): Promise<ChapterVersion> {
  return apiFetch<ChapterVersion>("/versions", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function updateVersionMetadata(
  token: string,
  versionId: string,
  payload: { description?: string; priceCoins?: number },
): Promise<void> {
  await apiFetch<void>(`/versions/${encodeURIComponent(versionId)}`, {
    method: "PATCH",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function publishVersion(token: string, versionId: string): Promise<void> {
  await apiFetch<void>(`/versions/${encodeURIComponent(versionId)}/status`, {
    method: "PATCH",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ status: "published" }),
  });
}

export async function deleteVersion(token: string, versionId: string): Promise<void> {
  await apiFetch<void>(`/versions/${encodeURIComponent(versionId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function uploadPage(token: string, versionId: string, file: File): Promise<UploadPageResult> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<UploadPageResult>(`/upload/versions/${encodeURIComponent(versionId)}/pages`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
}

export async function reorderPages(token: string, versionId: string, pages: string[]): Promise<void> {
  await apiFetch<void>(`/upload/versions/${encodeURIComponent(versionId)}/pages`, {
    method: "PUT",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ pages }),
  });
}

export async function deletePage(token: string, versionId: string, pageUrl: string): Promise<void> {
  await apiFetch<void>(`/upload/versions/${encodeURIComponent(versionId)}/pages`, {
    method: "DELETE",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ pageUrl }),
  });
}

export function toStudioImageUrl(pageUrl: string): string {
  return normalizeProxyUrl(pageUrl);
}
