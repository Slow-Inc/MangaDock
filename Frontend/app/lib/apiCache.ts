"use client";

// TTL presets (ms)
export const TTL = {
  SHORT: 60_000,       // 60s  — mutable forum data
  MEDIUM: 5 * 60_000,  // 5min — search results
  LONG: 30 * 60_000,   // 30min — quasi-static data
} as const;

// LRU cap — evict least-recently-used entry when store exceeds this size
const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  data: T;
  ts: number;
  ttl: number;
  staleAfter: number; // SWR threshold — background re-fetch triggers past this age
  tags: string[];
  revalidating: boolean;
}

// JavaScript Map preserves insertion order → first entry = LRU, last = MRU
const store = new Map<string, CacheEntry<unknown>>();

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.ts > entry.ttl;
}

function isStale(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.ts > entry.staleAfter;
}

// Promote key to MRU position by re-inserting at the end of the Map
function promote(key: string, entry: CacheEntry<unknown>): void {
  store.delete(key);
  store.set(key, entry);
}

// Evict the oldest (LRU) entry if the store is at capacity
function evictIfFull(): void {
  if (store.size >= MAX_ENTRIES) {
    const lruKey = store.keys().next().value;
    if (lruKey !== undefined) store.delete(lruKey);
  }
}

export function cacheSet<T>(
  key: string,
  data: T,
  ttl: number,
  options?: { staleAfter?: number; tags?: string[] },
): void {
  // Delete first so re-insert lands at MRU position (and size check stays accurate)
  store.delete(key);
  evictIfFull();
  store.set(key, {
    data,
    ts: Date.now(),
    ttl,
    staleAfter: options?.staleAfter ?? Math.floor(ttl * 0.67),
    tags: options?.tags ?? [],
    revalidating: false,
  } as CacheEntry<T>);
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (isExpired(entry)) {
    store.delete(key);
    return undefined;
  }
  // Promote to MRU on access
  promote(key, entry);
  return entry.data;
}

export function cacheInvalidate(...keys: string[]): void {
  for (const key of keys) store.delete(key);
}

export function cacheClearByTag(tag: string): void {
  for (const [key, entry] of store) {
    if (entry.tags.includes(tag)) store.delete(key);
  }
}

// Clear everything — called on auth change to prevent cross-user bleed
export function clearAllApiCache(): void {
  store.clear();
}

/**
 * Return cached data immediately if fresh.
 * If stale (but not expired): return cached AND trigger a silent background re-fetch.
 * If expired or missing: fetch, cache, and return.
 */
export async function cacheOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  options?: { staleAfter?: number; tags?: string[] },
): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && !isExpired(entry)) {
    promote(key, entry);
    if (isStale(entry) && !entry.revalidating) {
      entry.revalidating = true;
      fetcher()
        .then(data => cacheSet(key, data, ttl, options))
        .catch(() => {
          const e = store.get(key) as CacheEntry<T> | undefined;
          if (e) e.revalidating = false;
        });
    }
    return entry.data;
  }

  const data = await fetcher();
  cacheSet(key, data, ttl, options);
  return data;
}
