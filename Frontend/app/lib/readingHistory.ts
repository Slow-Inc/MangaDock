/**
 * readingHistory — local-first reading history with batched sync.
 *
 * Flow:
 *  1. addToHistory / clearHistory update localStorage + in-memory immediately.
 *  2. Debounce timer (5s) is reset on each change.
 *  3. After 5s idle, diffs are flushed to the backend:
 *     - upsert changed items (POST /users/me/history)
 *     - delete removed items (DELETE /users/me/history/:id or DELETE /users/me/history for clear-all)
 *  4. On login, AuthContext calls loadHistoryData() to restore history.
 */

import { apiFetch } from "./apiFetch";
import { createAuthHeaders } from "./apiUtils";
import { parseJsonArray } from "./safeJson";

const API_BASE = "/api/proxy";
const STORAGE_KEY = "mangadock_reading_history";
const SYNCED_KEY = "mangadock_history_synced";   // IDs known to be synced to server
const MAX_ITEMS = 30;
const FLUSH_DELAY = 5_000;

export const HISTORY_EVENT = "reading-history-updated";

export type HistoryBook = {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  /** Local /img-cache/… path when backend image cache is active. */
  thumbnailLocal?: string;
  authors: string[];
  description: string;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
  lastReadAt: number; // unix ms
  lastChapterId?: string;   // chapter last opened
  lastChapterNumber?: string | null; // display number e.g. "12"
};

// ─── In-memory state ────────────────────────────────────────────────────────
let books: HistoryBook[] = [];
let syncedIds: Set<string> = new Set();     // IDs currently synced to server
let pendingUpserts: Map<string, HistoryBook> = new Map();  // to add/update
let pendingDeletes: Set<string> = new Set(); // to remove from database
let clearAll = false;                        // flag: DELETE /users/me/history
let initialized = false;
let backfillDone = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let getTokenFn: (() => Promise<string | null>) | null = null;

// ─── Token supplier (set by AuthContext) ────────────────────────────────────
export function setHistoryTokenSupplier(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

// ─── Persistence ────────────────────────────────────────────────────────────
function saveToLS() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...syncedIds]));
  } catch { /* quota */ }
}

function loadFromLS() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) books = JSON.parse(raw) as HistoryBook[];
    const synced = localStorage.getItem(SYNCED_KEY);
    if (synced) syncedIds = new Set(JSON.parse(synced) as string[]);
  } catch { books = []; }
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(HISTORY_EVENT));
}

// ─── Back-fill chapter numbers for old history entries ───────────────────────
// Entries saved before lastChapterNumber was tracked have lastChapterId but no
// lastChapterNumber. This runs once after history loads, fetching chapters for
// each affected manga and patching the in-memory + localStorage entries.
async function backfillChapterNumbers() {
  if (backfillDone) return;
  backfillDone = true;

  // Only process UUID-shaped manga IDs (MangaDex)
  const isUUID = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const toFix = books.filter(
    (b) => b.lastChapterId && b.lastChapterNumber === undefined && isUUID(b.id)
  );
  if (toFix.length === 0) return;

  const uniqueMangaIds = [...new Set(toFix.map((b) => b.id))];

  await Promise.allSettled(
    uniqueMangaIds.map(async (mangaId) => {
      try {
        const res = await apiFetch(`${API_BASE}/books/manga/${mangaId}/chapters`);
        if (!res.ok) return;
        const chapters = await parseJsonArray<{ id: string; chapterNumber: string | null }>(res);
        if (!chapters) {
          console.warn(`[readingHistory] chapter backfill skipped for ${mangaId}: response body was not a JSON array`);
          return;
        }

        let changed = false;
        for (const b of books) {
          if (b.id !== mangaId || !b.lastChapterId || b.lastChapterNumber !== undefined) continue;
          const ch = chapters.find((c) => c.id === b.lastChapterId);
          b.lastChapterNumber = ch?.chapterNumber ?? null;
          pendingUpserts.set(b.id, b);
          changed = true;
        }
        if (changed) {
          saveToLS();
          notify();
          scheduleFlush();
        }
      } catch { /* ignore */ }
    })
  );
}

// ─── Debounced flush ─────────────────────────────────────────────────────────
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushToServer, FLUSH_DELAY);
}

async function flushToServer() {
  flushTimer = null;
  const token = await getTokenFn?.();
  if (!token) return;

  const headers = createAuthHeaders(token, { "Content-Type": "application/json" });

  try {
    if (clearAll) {
      // Delete entire collection in one call
      await fetch(`${API_BASE}/users/me/history`, { method: "DELETE", headers });
      syncedIds = new Set();
      clearAll = false;
    } else {
      // Upsert changed items + delete removed ones in parallel
      await Promise.all([
        ...[...pendingUpserts.values()].map((b) =>
          fetch(`${API_BASE}/users/me/history`, {
            method: "POST",
            headers,
            body: JSON.stringify(b),
          })
        ),
        ...[...pendingDeletes].map((id) =>
          fetch(`${API_BASE}/users/me/history/${id}`, { method: "DELETE", headers })
        ),
      ]);
      for (const id of pendingUpserts.keys()) syncedIds.add(id);
      for (const id of pendingDeletes) syncedIds.delete(id);
    }

    pendingUpserts.clear();
    pendingDeletes.clear();
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...syncedIds]));
  } catch { /* retry on next change */ }
}

// ─── Load from server on login ──────────────────────────────────────────────
export async function loadHistoryData(token: string) {
  loadFromLS();
  try {
    const res = await fetch(`${API_BASE}/users/me/history`, {
      headers: createAuthHeaders(token),
    });
    if (!res.ok) return;
    const remote = await parseJsonArray<HistoryBook>(res);
    if (!remote) return;

    // Merge: keep local entries not in remote, then prepend remote sorted by lastReadAt
    const localOnly = books.filter((b) => !remote.find((r) => r.id === b.id));
    const merged = [...remote, ...localOnly]
      .sort((a, b) => b.lastReadAt - a.lastReadAt)
      .slice(0, MAX_ITEMS);

    books = merged;
    syncedIds = new Set(remote.map((b) => b.id));

    // Any local-only items are pending upserts
    for (const b of localOnly) pendingUpserts.set(b.id, b);
    if (localOnly.length > 0) scheduleFlush();

    saveToLS();
    notify();
    // Back-fill chapter numbers for any entry missing them (e.g. from old sync data)
    backfillChapterNumbers();
  } catch { /* ignore */ }
}

/** Immediately flush any pending history changes to server (call before logout). */
export async function flushHistoryNow(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (pendingUpserts.size > 0 || pendingDeletes.size > 0) {
    await flushToServer();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function addToHistory(book: Omit<HistoryBook, "lastReadAt">): void {
  if (typeof window === "undefined") return;
  loadFromLS();
  const entry: HistoryBook = { ...book, lastReadAt: Date.now() };
  books = [entry, ...books.filter((b) => b.id !== book.id)].slice(0, MAX_ITEMS);
  pendingUpserts.set(entry.id, entry);
  pendingDeletes.delete(entry.id);
  saveToLS();
  notify();
  scheduleFlush();
}

export function getHistory(): HistoryBook[] {
  loadFromLS();
  // Fire-and-forget: patch old entries that are missing lastChapterNumber
  if (typeof window !== "undefined") backfillChapterNumbers();
  return books;
}

/**
 * Clear a stale thumbnailLocal path for a book.
 * Called when an img-cache image 404s so future loads use the CDN URL instead.
 */
export function patchThumbnailLocal(bookId: string): void {
  if (typeof window === "undefined") return;
  loadFromLS();
  const book = books.find((b) => b.id === bookId);
  if (!book || !book.thumbnailLocal) return;
  book.thumbnailLocal = undefined;
  pendingUpserts.set(book.id, book);
  saveToLS();
  scheduleFlush();
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  loadFromLS();
  const hadItems = books.length > 0;
  books = [];
  pendingUpserts.clear();
  pendingDeletes.clear();
  clearAll = hadItems && syncedIds.size > 0;
  syncedIds = new Set();
  initialized = false; // reset so next loadFromLS starts fresh
  [STORAGE_KEY, SYNCED_KEY].forEach((k) => localStorage.removeItem(k));
  notify();
  if (clearAll) scheduleFlush();
}

