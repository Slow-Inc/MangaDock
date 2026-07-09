/**
 * userCache — local-first favorites & liked store with batched sync.
 *
 * Flow:
 *  1. All toggles update localStorage + in-memory state immediately.
 *  2. A debounce timer (FLUSH_DELAY ms) is reset on each change.
 *  3. After FLUSH_DELAY with no new changes, all pending diffs are flushed
 *     to the backend in parallel.
 *  4. On login (AuthContext calls loadUserData), server state is fetched
 *     and merged — local additions are preserved, remote state wins for removals.
 */

import { createAuthHeaders } from "./apiUtils";
import { parseJsonArray } from "./safeJson";

const API_BASE = "/api/proxy";
const LS_FAV = "mb_favorites";
const LS_LIKED = "mb_liked";
const LS_FAV_SYNCED = "mb_fav_synced"; // IDs known to be synced to server
const LS_LIKED_SYNCED = "mb_liked_synced";
const FLUSH_DELAY = 5_000; // ms to wait before syncing

export const CACHE_EVENT = "mb-cache-updated";

export type CachedBook = {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  authors: string[];
  description: string;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
};

// ─── In-memory state ───────────────────────────────────────────────────────
let favorites: Map<string, CachedBook> = new Map();
let liked: Set<string> = new Set();
let syncedFavorites: Set<string> = new Set(); // what server currently has
let syncedLiked: Set<string> = new Set();
let initialized = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let getTokenFn: (() => Promise<string | null>) | null = null;

// ─── Token supplier (set by AuthContext) ───────────────────────────────────
export function setTokenSupplier(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

// ─── Persistence ───────────────────────────────────────────────────────────
function saveToLS() {
  try {
    localStorage.setItem(LS_FAV, JSON.stringify([...favorites.values()]));
    localStorage.setItem(LS_LIKED, JSON.stringify([...liked]));
  } catch { /* quota exceeded — ignore */ }
}

function loadFromLS() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const fav = localStorage.getItem(LS_FAV);
    if (fav) {
      const arr: CachedBook[] = JSON.parse(fav);
      favorites = new Map(arr.map((b) => [b.id, b]));
    }
    const lk = localStorage.getItem(LS_LIKED);
    if (lk) liked = new Set(JSON.parse(lk) as string[]);
    const sf = localStorage.getItem(LS_FAV_SYNCED);
    if (sf) syncedFavorites = new Set(JSON.parse(sf) as string[]);
    const sl = localStorage.getItem(LS_LIKED_SYNCED);
    if (sl) syncedLiked = new Set(JSON.parse(sl) as string[]);
  } catch { /* corrupt data — start fresh */ }
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CACHE_EVENT));
}

// ─── Batch flush ────────────────────────────────────────────────────────────
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_DELAY);
}

async function flush() {
  flushTimer = null;
  const token = await getTokenFn?.();
  if (!token) return; // not logged in — skip sync

  const headers = createAuthHeaders(token, { "Content-Type": "application/json" });

  // Compute diffs vs last known database state
  const toAddFav: CachedBook[] = [];
  const toRemoveFav: string[] = [];
  const toAddLike: string[] = [];
  const toRemoveLike: string[] = [];

  for (const [id, book] of favorites) {
    if (!syncedFavorites.has(id)) toAddFav.push(book);
  }
  for (const id of syncedFavorites) {
    if (!favorites.has(id)) toRemoveFav.push(id);
  }
  for (const id of liked) {
    if (!syncedLiked.has(id)) toAddLike.push(id);
  }
  for (const id of syncedLiked) {
    if (!liked.has(id)) toRemoveLike.push(id);
  }

  if (!toAddFav.length && !toRemoveFav.length && !toAddLike.length && !toRemoveLike.length) return;

  try {
    await Promise.all([
      ...toAddFav.map((b) =>
        fetch(`${API_BASE}/users/me/favorites`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: b.id,
            title: b.title,
            thumbnail: b.thumbnail,
            authors: b.authors ?? [],
            description: b.description ?? "",
            categories: b.categories ?? [],
            publishedDate: b.publishedDate ?? "",
            averageRating: b.averageRating ?? 0,
            ratingsCount: b.ratingsCount ?? 0,
          }),
        })
      ),
      ...toRemoveFav.map((id) =>
        fetch(`${API_BASE}/users/me/favorites/${id}`, { method: "DELETE", headers })
      ),
      ...toAddLike.map((id) =>
        fetch(`${API_BASE}/users/me/liked/${id}`, { method: "POST", headers })
      ),
      ...toRemoveLike.map((id) =>
        fetch(`${API_BASE}/users/me/liked/${id}`, { method: "DELETE", headers })
      ),
    ]);

    // Mark synced
    syncedFavorites = new Set(favorites.keys());
    syncedLiked = new Set(liked);
    localStorage.setItem(LS_FAV_SYNCED, JSON.stringify([...syncedFavorites]));
    localStorage.setItem(LS_LIKED_SYNCED, JSON.stringify([...syncedLiked]));
  } catch {
    // Network error — retry on next change
  }
}

// ─── Load from server (called on login) ────────────────────────────────────
export async function loadUserData(token: string) {
  loadFromLS();
  const headers = createAuthHeaders(token);
  try {
    const [favRes, likedRes] = await Promise.all([
      fetch(`${API_BASE}/users/me/favorites`, { headers }),
      fetch(`${API_BASE}/users/me/liked`, { headers }),
    ]);
    if (!favRes.ok || !likedRes.ok) return;

    const remoteFavs = await parseJsonArray<CachedBook>(favRes);
    const remoteLiked = await parseJsonArray<string>(likedRes);
    if (!remoteFavs || !remoteLiked) {
      console.warn("[userCache] favorites/liked sync skipped: response body was not a JSON array");
      return;
    }

    // Merge — remote is source of truth for what WAS there; keep local additions
    const remoteIds = new Set(remoteFavs.map((f) => f.id));

    // Add remote favorites not already local (prefer local copy if it has richer data)
    for (const rf of remoteFavs) {
      const local = favorites.get(rf.id);
      if (!local) {
        favorites.set(rf.id, rf);
      } else if (!local.categories?.length && rf.categories?.length) {
        // Local has incomplete data — merge remote fields in
        favorites.set(rf.id, { ...rf, ...local, categories: rf.categories });
      }
    }

    // Sync liked
    for (const id of remoteLiked) liked.add(id);

    syncedFavorites = remoteIds;
    syncedLiked = new Set(remoteLiked);
    localStorage.setItem(LS_FAV_SYNCED, JSON.stringify([...syncedFavorites]));
    localStorage.setItem(LS_LIKED_SYNCED, JSON.stringify([...syncedLiked]));
    saveToLS();
    notify();
  } catch { /* ignore */ }
}

/** Immediately flush any pending changes to server (call before logout). */
export async function flushNow(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await flush();
}

// ─── Clear on logout ────────────────────────────────────────────────────────
export function clearUserCache() {
  favorites = new Map();
  liked = new Set();
  syncedFavorites = new Set();
  syncedLiked = new Set();
  initialized = false;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  [LS_FAV, LS_LIKED, LS_FAV_SYNCED, LS_LIKED_SYNCED].forEach((k) =>
    localStorage.removeItem(k)
  );
  notify();
}

// ─── Public API ─────────────────────────────────────────────────────────────
export function init() {
  loadFromLS();
}

export function isFavorited(bookId: string): boolean {
  loadFromLS();
  return favorites.has(bookId);
}

export function isLiked(bookId: string): boolean {
  loadFromLS();
  return liked.has(bookId);
}

export function toggleFavorite(book: CachedBook): boolean {
  loadFromLS();
  if (favorites.has(book.id)) {
    favorites.delete(book.id);
  } else {
    favorites.set(book.id, book);
  }
  saveToLS();
  notify();
  scheduleFlush();
  return favorites.has(book.id);
}

export function toggleLiked(bookId: string): boolean {
  loadFromLS();
  if (liked.has(bookId)) {
    liked.delete(bookId);
  } else {
    liked.add(bookId);
  }
  saveToLS();
  notify();
  scheduleFlush();
  return liked.has(bookId);
}

export function getFavorites(): CachedBook[] {
  loadFromLS();
  return [...favorites.values()];
}
