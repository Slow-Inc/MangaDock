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
import type { StorageProvider } from '../common/storage/storage-provider.interface';

const IMG_CACHE_PREFIX = '/img-cache/';
// Uploaded chapter pages the Reader serves from the backend's own disk. The
// Reader's <img src> is the proxy path (`/api/proxy/uploads/...`); the backend
// also sees the bare `/uploads/...` form. Both resolve to the uploads root.
const UPLOADS_PREFIX_RE = /^(?:\/api\/proxy)?\/uploads\//;

export function isImgCachePath(pageUrl: string): boolean {
  return pageUrl.startsWith(IMG_CACHE_PREFIX);
}

export function isLocalUploadPath(pageUrl: string): boolean {
  return UPLOADS_PREFIX_RE.test(pageUrl);
}

/** Read a backend-local page from disk under `root`, decoding percent-encoding
 *  and normalizing separators BEFORE resolving so encoded ("..%2e") and
 *  backslash ("..\\") traversal can't escape the root. */
async function readLocalPage(root: string, rel: string, kind: string, original: string): Promise<Buffer> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    throw new Error(`invalid ${kind} path: ${original}`);
  }
  decoded = decoded.replace(/\\/g, '/');
  const rootAbs = path.resolve(root);
  const resolved = path.resolve(rootAbs, decoded);
  const relative = path.relative(rootAbs, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${kind} path escapes the ${kind} root: ${original}`);
  }
  return fs.readFile(resolved);
}

export async function loadPageBytes(
  pageUrl: string,
  opts: {
    imgCacheRoot: string;
    uploadsRoot?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    storage?: Pick<StorageProvider, 'get'>;
  },
): Promise<Buffer> {
  if (isImgCachePath(pageUrl)) {
    const rel = pageUrl.slice(IMG_CACHE_PREFIX.length);
    if (opts.storage) {
      return opts.storage.get(`img-cache/${rel}`);
    }
    return readLocalPage(opts.imgCacheRoot, rel, 'img-cache', pageUrl);
  }
  // Uploaded chapter pages live on the backend's disk — read them straight from
  // there. Re-fetching the relative `/api/proxy/uploads/...` URL has no origin
  // to resolve against (it threw "Failed to parse URL"); reading from disk also
  // keeps the translated patch byte-identical to the displayed page (#156).
  if (isLocalUploadPath(pageUrl)) {
    return readLocalPage(
      opts.uploadsRoot ?? 'uploads',
      pageUrl.replace(UPLOADS_PREFIX_RE, ''),
      'uploads',
      pageUrl,
    );
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeout = AbortSignal.timeout(30_000);
  const res = await fetchImpl(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (+https://2552667.xyz)',
      Referer: 'https://mangadex.org/',
    },
    signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${pageUrl}`);
  return Buffer.from(await res.arrayBuffer());
}
