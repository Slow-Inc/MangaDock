'use client';

// Client side of document translation. The translating itself lives in the backend (GET /books/translate:
// the provider key, the Redis cache and the per-client rate limit are all there); this only asks for one
// part at a time and copes with the limit.

import { cacheOrFetch, TTL } from '../lib/apiCache';
import type { Lang } from './lang-context';

const API = '/api/proxy/books/translate';
const RATE_LIMIT_WAIT_MS = 7_000; // the backend allows 30 parts a minute per client
const RATE_LIMIT_TRIES = 8;
const TRANSIENT_TRIES = 3;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
  });
}

async function request(text: string, to: Lang, signal: AbortSignal, onWait?: (waiting: boolean) => void): Promise<string | null> {
  let rateLimited = 0;
  let failed = 0;
  for (;;) {
    const res = await fetch(`${API}?text=${encodeURIComponent(text)}&to=${to}&kind=doc`, { signal }).catch(() => null);
    if (res?.ok) {
      const data: { translatedText: string; translated: boolean } = await res.json();
      // translated:false = the backend left it alone (already in `to`, or no provider is configured).
      return data.translated ? data.translatedText : null;
    }
    if (res?.status === 429) {
      if (++rateLimited >= RATE_LIMIT_TRIES) throw new Error('rate limited');
      onWait?.(true);
      try { await sleep(RATE_LIMIT_WAIT_MS, signal); } finally { onWait?.(false); }
      continue;
    }
    if (++failed >= TRANSIENT_TRIES || (res && res.status < 500)) throw new Error(`translate failed (${res?.status ?? 'network'})`);
    await sleep(1_500 * failed, signal);
  }
}

/**
 * Translates one part of a document. A part already translated this session (or in the last half hour) is
 * not asked for again; a failure is never remembered, so retrying asks again. Resolves null when the backend
 * returned the text unchanged.
 */
export function translatePart(text: string, to: Lang, signal: AbortSignal, onWait?: (waiting: boolean) => void): Promise<string | null> {
  return cacheOrFetch<string | null>(`docpart:${to}:${text}`, () => request(text, to, signal, onWait), TTL.LONG);
}
