// Server-side cache in front of the GitHub REST API for the docs site.
//
// Why it exists: unauthenticated GitHub allows 60 requests/hour per IP, and the docs pages re-read the
// same lists on every visit. This keeps what GitHub last said and spends as few calls as possible:
//   1. fresh entry            -> served from memory, no call
//   2. stale entry            -> one conditional call (If-None-Match); 304 costs no rate limit and just renews it
//   3. GitHub fails / limited -> serve the stale entry instead of an error (an error is never stored)
//   4. same URL, many readers -> one upstream call shared by all of them
// Process-local on purpose (a Map, no Redis): the cost of a cold instance is one extra GitHub call.

export interface CacheResult {
  status: number;
  body: string;
  /** hit = fresh from memory · revalidated = 304 · miss = fetched · stale = GitHub failed, old copy served · error = nothing to serve */
  cache: 'hit' | 'revalidated' | 'miss' | 'stale' | 'error';
}

/** `retryAt`: set while GitHub is failing, so the old copy is served until then instead of asking on every request. */
interface Entry { body: string; etag: string | null; ts: number; retryAt?: number }

const RETRY_AFTER_FAILURE_MS = 30_000;

export interface UpstreamResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export function createGithubCache(opts: {
  fetchUpstream: (url: string, headers: Record<string, string>) => Promise<UpstreamResponse>;
  now?: () => number;
  freshMs?: number;
  maxEntries?: number;
}) {
  const { fetchUpstream, now = Date.now, freshMs = 5 * 60_000, maxEntries = 200 } = opts;
  const store = new Map<string, Entry>();
  const pending = new Map<string, Promise<CacheResult>>();

  const remember = (url: string, e: Entry) => {
    store.delete(url); // re-insert so the oldest key is always first
    if (store.size >= maxEntries) store.delete(store.keys().next().value as string);
    store.set(url, e);
  };

  async function load(url: string, old: Entry | undefined): Promise<CacheResult> {
    const stale = (): CacheResult | null => {
      if (!old) return null;
      old.retryAt = now() + RETRY_AFTER_FAILURE_MS;
      return { status: 200, body: old.body, cache: 'stale' };
    };
    try {
      const res = await fetchUpstream(url, old?.etag ? { 'If-None-Match': old.etag } : {});
      if (res.status === 304 && old) {
        remember(url, { body: old.body, etag: old.etag, ts: now() });
        return { status: 200, body: old.body, cache: 'revalidated' };
      }
      const body = await res.text();
      if (res.ok) {
        remember(url, { body, etag: res.headers.get('etag'), ts: now() });
        return { status: 200, body, cache: 'miss' };
      }
      // GitHub failing or limiting us (5xx, 403, 429): the old copy is better than nothing. Any other status is an
      // answer about the resource itself (a deleted issue is 404/410): forget the old copy and pass the status on.
      if (res.status >= 500 || res.status === 403 || res.status === 429) return stale() ?? { status: res.status, body, cache: 'error' };
      store.delete(url);
      return { status: res.status, body, cache: 'error' };
    } catch {
      return stale() ?? { status: 502, body: JSON.stringify({ error: 'GitHub request failed' }), cache: 'error' };
    }
  }

  return {
    get(url: string): Promise<CacheResult> {
      const e = store.get(url);
      if (e && now() - e.ts < freshMs) return Promise.resolve({ status: 200, body: e.body, cache: 'hit' });
      if (e?.retryAt && now() < e.retryAt) return Promise.resolve({ status: 200, body: e.body, cache: 'stale' });
      const running = pending.get(url);
      if (running) return running;
      const p = load(url, e).finally(() => pending.delete(url));
      pending.set(url, p);
      return p;
    },
    /** For tests and diagnostics. */
    size: () => store.size,
  };
}
