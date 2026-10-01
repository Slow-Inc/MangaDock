import { supabase } from "./supabase";
import type { ChapterVersion } from "./types";
import { cacheOrFetch, TTL } from "./apiCache";
import { createAuthHeaders, parseErrorResponse } from "./apiUtils";
import { getHardwareId } from "./fingerprint";

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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Studio version/upload routes are HWID-gated (backend HardwareIdMiddleware:
  // /versions/:id, /upload/*). Attach the device id to every studioApi call from
  // this single choke point. Harmless on non-gated routes (wallet/users/unlock) —
  // the backend only enforces the header where HWID_REQUIRED matches.
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "x-hardware-id": getHardwareId(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text || text.trim() === "") return undefined as T;
  return JSON.parse(text) as T;
}

export async function searchBooks(query: string): Promise<{ items: StudioBook[]; total: number }> {
  return cacheOrFetch(
    `search:${query}`,
    async () => {
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
    },
    TTL.MEDIUM,
    { staleAfter: 4 * 60_000 },
  );
}

export function getBookCoverUrl(bookId: string): string {
  return `${API_BASE}/books/manga/${encodeURIComponent(bookId)}/cover`;
}

export async function getBookChapters(bookId: string): Promise<StudioChapter[]> {
  return apiFetch<StudioChapter[]>(`/books/manga/${encodeURIComponent(bookId)}/chapters`);
}

export async function getMyVersions(token: string): Promise<ChapterVersion[]> {
  return apiFetch<ChapterVersion[]>("/versions/me/versions", {
    headers: createAuthHeaders(token),
  });
}

export async function getVersion(token: string, versionId: string): Promise<ChapterVersion> {
  return apiFetch<ChapterVersion>(`/versions/${encodeURIComponent(versionId)}`, {
    headers: createAuthHeaders(token),
  });
}

export async function createVersion(token: string, payload: CreateVersionInput): Promise<ChapterVersion> {
  return apiFetch<ChapterVersion>("/versions", {
    method: "POST",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
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
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}

export async function publishVersion(token: string, versionId: string): Promise<void> {
  await apiFetch<void>(`/versions/${encodeURIComponent(versionId)}/status`, {
    method: "PATCH",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ status: "published" }),
  });
}

export async function deleteVersion(token: string, versionId: string): Promise<void> {
  await apiFetch<void>(`/versions/${encodeURIComponent(versionId)}`, {
    method: "DELETE",
    headers: createAuthHeaders(token),
  });
}

export async function uploadPage(token: string, versionId: string, file: File): Promise<UploadPageResult> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<UploadPageResult>(`/upload/versions/${encodeURIComponent(versionId)}/pages`, {
    method: "POST",
    headers: createAuthHeaders(token),
    body: form,
  });
}

export async function reorderPages(token: string, versionId: string, pages: string[]): Promise<void> {
  await apiFetch<void>(`/upload/versions/${encodeURIComponent(versionId)}/pages`, {
    method: "PUT",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ pages }),
  });
}

export async function deletePage(token: string, versionId: string, pageUrl: string): Promise<void> {
  await apiFetch<void>(`/upload/versions/${encodeURIComponent(versionId)}/pages`, {
    method: "DELETE",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ pageUrl }),
  });
}

export function toStudioImageUrl(pageUrl: string): string {
  return normalizeProxyUrl(pageUrl);
}

// ── Wallet API ──────────────────────────────────────────────────────────────

export async function getWalletBalance(token: string): Promise<{ balance: number }> {
  return apiFetch<{ balance: number }>("/wallet/balance", {
    headers: createAuthHeaders(token),
  });
}

export type TopupResult = {
  paymentId: string;
  qrString: string;
  expiresAt: string;
};

export type TopupStatus = {
  status: "pending" | "paid" | "expired";
  balance?: number;
};

export async function createTopup(token: string, amount: number): Promise<TopupResult> {
  return apiFetch<TopupResult>("/wallet/topup/create", {
    method: "POST",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ amount }),
  });
}

export async function getTopupStatus(token: string, paymentId: string): Promise<TopupStatus> {
  return apiFetch<TopupStatus>(`/wallet/topup/status/${encodeURIComponent(paymentId)}`, {
    headers: createAuthHeaders(token),
  });
}

export async function cancelTopup(token: string, paymentId: string): Promise<{ cancelled: boolean }> {
  return apiFetch<{ cancelled: boolean }>(`/wallet/topup/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    headers: createAuthHeaders(token),
  });
}

export async function simulateTopup(token: string, paymentId: string): Promise<{ simulated: boolean }> {
  return apiFetch<{ simulated: boolean }>(`/wallet/topup/${encodeURIComponent(paymentId)}/simulate`, {
    method: 'POST',
    headers: createAuthHeaders(token),
  });
}

export type WalletTransaction = {
  id: string;
  uid: string;
  type: "topup" | "purchase" | "refund" | "reward";
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
};

export async function getWalletTransactions(token: string): Promise<WalletTransaction[]> {
  return apiFetch<WalletTransaction[]>("/wallet/transactions", {
    headers: createAuthHeaders(token),
  });
}

export type CreatorEarnings = {
  totalSales: number;
  totalEarned: number;
  titlesSold: number;
  uniqueBuyers: number;
};

export async function getCreatorEarnings(token: string): Promise<CreatorEarnings> {
  return apiFetch<CreatorEarnings>("/wallet/earnings", {
    headers: createAuthHeaders(token),
  });
}

// ── Unlock API ──────────────────────────────────────────────────────────────

export async function checkUnlock(token: string, versionId: string): Promise<{ unlocked: boolean }> {
  return apiFetch<{ unlocked: boolean }>(`/unlock/check/${encodeURIComponent(versionId)}`, {
    headers: createAuthHeaders(token),
  });
}

export async function getUnlocksForTitle(token: string, titleId: string): Promise<string[]> {
  return apiFetch<string[]>(`/unlock/title/${encodeURIComponent(titleId)}`, {
    headers: createAuthHeaders(token),
  });
}

export type PurchaseResult = {
  unlocked: boolean;
  alreadyUnlocked?: boolean;
  pricePaid?: number;
  balance?: number;
};

export async function purchaseUnlock(token: string, versionId: string): Promise<PurchaseResult> {
  return apiFetch<PurchaseResult>(`/unlock/${encodeURIComponent(versionId)}`, {
    method: "POST",
    headers: createAuthHeaders(token),
  });
}

// ── Translator Profile API ──────────────────────────────────────────────────

export type TranslatorProfile = {
  bio: string;
  translatorLanguages: string[];
  country: string;
  preferredLanguage: string;
};

export async function getMyProfile(token: string) {
  return apiFetch<{
    uid: string;
    email: string;
    displayName: string;
    photoUrl: string;
    role: string;
    bio: string;
    translatorLanguages: string[];
    country: string;
    preferredLanguage: string;
  }>("/users/me", { headers: createAuthHeaders(token) });
}

export async function updateTranslatorProfile(
  token: string,
  data: Partial<TranslatorProfile>,
) {
  return apiFetch<{ message: string }>("/users/me/translator-profile", {
    method: "PATCH",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
}

export async function becomeTranslator(
  token: string,
  data: { bio?: string; translatorLanguages?: string[] } = {},
) {
  return apiFetch<{ ok: boolean }>("/users/me/become-translator", {
    method: "POST",
    headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
}

export function subscribeTopupStream(
  token: string,
  paymentId: string,
  onPaid: (balance: number) => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    let res: Response;
    try {
      res = await fetch(
        `/api/proxy/wallet/topup/${encodeURIComponent(paymentId)}/stream`,
        {
          headers: createAuthHeaders(token),
          signal: controller.signal,
        },
      );
    } catch (e: any) {
      if (e?.name !== 'AbortError') onError(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    if (!res.ok || !res.body) {
      onError(new Error(`SSE ${res.status}`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim()) as {
              event: string;
              balance: number;
            };
            if (payload.event === 'payment.paid') onPaid(payload.balance);
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') onError(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  return () => controller.abort();
}
