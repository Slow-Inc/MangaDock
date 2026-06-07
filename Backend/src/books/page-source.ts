/**
 * Page byte loading for the translate flow (#156).
 *
 * Translation sources arrive as either raw CDN URLs or backend-local
 * /img-cache paths — the exact derivative the Reader displays. Local paths
 * are read straight from disk so the translated patches are generated from
 * byte-identical content; re-fetching could yield a different encode and
 * reintroduce the visible tone mismatch around patches.
 */
import { promises as fs } from 'fs';
import * as path from 'path';

const IMG_CACHE_PREFIX = '/img-cache/';

export function isImgCachePath(pageUrl: string): boolean {
  return pageUrl.startsWith(IMG_CACHE_PREFIX);
}

export async function loadPageBytes(
  pageUrl: string,
  opts: {
    imgCacheRoot: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  },
): Promise<Buffer> {
  if (!isImgCachePath(pageUrl)) {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const timeout = AbortSignal.timeout(30_000);
    const res = await fetchImpl(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MangaDock/1.0)',
        Referer: 'https://mangadex.org/',
      },
      signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${pageUrl}`);
    return Buffer.from(await res.arrayBuffer());
  }
  // Decode percent-encoding and normalize separators BEFORE resolving, so
  // encoded ("..%2e") and backslash ("..\\") traversal can't slip through.
  let rel: string;
  try {
    rel = decodeURIComponent(pageUrl.slice(IMG_CACHE_PREFIX.length));
  } catch {
    throw new Error(`invalid img-cache path: ${pageUrl}`);
  }
  rel = rel.replace(/\\/g, '/');
  const rootAbs = path.resolve(opts.imgCacheRoot);
  const resolved = path.resolve(rootAbs, rel);
  const relative = path.relative(rootAbs, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`img-cache path escapes the cache root: ${pageUrl}`);
  }
  return fs.readFile(resolved);
}
