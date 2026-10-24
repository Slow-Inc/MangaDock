/**
 * userCache — local-first favorites & liked store with batched sync.
 *
 * Flow:
 *  1. All toggles update localStorage + in-memory state immediately.
 *  2. A debounce timer (FLUSH_DELAY ms) is reset on each change.
 *  3. After FLUSH_DELAY with no new changes, all pending diffs are flushed
 *     to the backend in parallel.
 *     Only a request the server stored marks its item synced; a refused one stays
 *     pending and the flush retries after RETRY_DELAY (#985).
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
const RETRY_DELAY = 30_000; // a sync the server refused retries on its own, slower than the debounce (#985)

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
let cacheGeneration = 0;
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

/** The differences between local state and what the server is known to hold. */
function pendingChanges() {
  const toAddFav: CachedBook[] = [];
  const toRemoveFav: string[] = [];
  const toAddLike: string[] = [];
  const toRemoveLike: string[] = [];
  for (const [id, book] of favorites) if (!syncedFavorites.has(id)) toAddFav.push(book);
  for (const id of syncedFavorites) if (!favorites.has(id)) toRemoveFav.push(id);
  for (const id of liked) if (!syncedLiked.has(id)) toAddLike.push(id);
  for (const id of syncedLiked) if (!liked.has(id)) toRemoveLike.push(id);
  return { toAddFav, toRemoveFav, toAddLike, toRemoveLike };
}

function hasPending(): boolean {
  return Object.values(pendingChanges()).some((list) => list.length > 0);
}

async function flush() {
  const generation = cacheGeneration;
  flushTimer = null;
  const token = await getTokenFn?.();
  if (!token || generation !== cacheGeneration) return; // not logged in — skip sync

  const headers = createAuthHeaders(token, { "Content-Type": "application/json" });

  const { toAddFav, toRemoveFav, toAddLike, toRemoveLike } = pendingChanges();
  if (!toAddFav.length && !toRemoveFav.length && !toAddLike.length && !toRemoveLike.length) return;

  // fetch resolves on a 4xx/5xx too: only a request the server stored marks its own item synced, and the rest stay
  // pending for the next flush. A 4xx other than auth / timeout / rate limit will never succeed, so it is settled
  // (logged) instead of retried forever (#985).
  const stored = (req: Promise<Response>) =>
    req.then(
      (r) => {
        if (r.ok) return true;
        if (r.status >= 400 && r.status < 500 && ![401, 408, 429].includes(r.status)) {
          console.warn(`[userCache] sync request refused for good (${r.status}): ${r.url}`);
          return true;
        }
        return false;
      },
      () => false
    );
  const [favAdded, favRemoved, likeAdded, likeRemoved] = await Promise.all([
    Promise.all(
      toAddFav.map((b) =>
        stored(
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
        )
      )
    ),
    Promise.all(toRemoveFav.map((id) => stored(fetch(`${API_BASE}/users/me/favorites/${encodeURIComponent(id)}`, { method: "DELETE", headers })))),
    Promise.all(toAddLike.map((id) => stored(fetch(`${API_BASE}/users/me/liked/${encodeURIComponent(id)}`, { method: "POST", headers })))),
    Promise.all(toRemoveLike.map((id) => stored(fetch(`${API_BASE}/users/me/liked/${encodeURIComponent(id)}`, { method: "DELETE", headers })))),
  ]);

  // Applied only now, so a request that finishes after a logout never writes into the next user's state
  if (generation !== cacheGeneration) return;
  toAddFav.forEach((b, i) => favAdded[i] && syncedFavorites.add(b.id));
  toRemoveFav.forEach((id, i) => favRemoved[i] && syncedFavorites.delete(id));
  toAddLike.forEach((id, i) => likeAdded[i] && syncedLiked.add(id));
  toRemoveLike.forEach((id, i) => likeRemoved[i] && syncedLiked.delete(id));
  try {
    localStorage.setItem(LS_FAV_SYNCED, JSON.stringify([...syncedFavorites]));
    localStorage.setItem(LS_LIKED_SYNCED, JSON.stringify([...syncedLiked]));
  } catch { /* quota exceeded — the in-memory state still holds */ }

  // Whatever is still unsent — a refused request, or a toggle made while this flush was in flight that the
  // overlapping flush saw as already synced — gets a retry of its own
  if (hasPending() && !flushTimer) flushTimer = setTimeout(flush, RETRY_DELAY);
}

// ─── Load from server (called on login) ────────────────────────────────────
export async function loadUserData(token: string) {
  const generation = cacheGeneration;
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

    if (generation !== cacheGeneration) return;

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
  cacheGeneration++;
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
