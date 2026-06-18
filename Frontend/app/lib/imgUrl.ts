/**
 * Resolves the best available URL for a book thumbnail.
 *
 * When IMAGE_CACHE_ENABLED=true on the backend, the API response includes a
 * `thumbnailLocal` field (e.g. "/img-cache/{id}/thumbnail.jpg") pointing to a
 * file cached on the backend's filesystem.  This helper constructs the full
 * URL from the backend base and returns it; otherwise it falls back to the
 * original external URL.
 *
 * Usage:
 *   import { resolvedThumbnail } from "@/lib/imgUrl";
 *   <Image src={resolvedThumbnail(book)} … />
 */

const API_BASE = "/api/proxy";

/** Cloudflare Worker URL from env */
const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL || "";
const USE_CF_WORKER = process.env.NEXT_PUBLIC_USE_CF_WORKER === "true";

/** MangaDex CDN hostname — images from here get proxied through our backend. */
const MANGADEX_CDN = "uploads.mangadex.org";

/**
 * Returns the effective base URL for local assets (/uploads or /img-cache).
 * If USE_CF_WORKER is true, it points to the Worker; otherwise it uses the Frontend Proxy.
 */
function getAssetBaseUrl(): string {
  if (USE_CF_WORKER && CF_WORKER_URL) {
    return CF_WORKER_URL;
  }
  return API_BASE;
}

/**
 * Strip any hardcoded backend origin (http://localhost:PORT or http://hostname:PORT)
 * from a URL and replace with the effective asset base path.
 */
export function toRelativeProxyUrl(url: string): string {
  if (!url) return url;
  const assetBase = getAssetBaseUrl();

  if (url.startsWith('/uploads/') || url.startsWith('/img-cache/')) {
    return `${assetBase}${url}`;
  }
  try {
    const parsed = new URL(url);
    const pathWithQuery = `${parsed.pathname}${parsed.search}`;
    if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/img-cache/')) {
      return `${assetBase}${pathWithQuery}`;
    }
    // For legacy reasons, any HTTP URL from localhost is treated as a backend asset
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return `${assetBase}${pathWithQuery}`;
    }
  } catch {
    // Not an absolute URL — return as-is.
  }
  return url;
}

/** Route any external image URL through the Next.js API proxy when needed. */
export function proxyImageUrl(url: string): string {
  if (url.includes(MANGADEX_CDN)) {
    return `/api/img-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/** The src to swap to when a cached thumbnail 404s — proxy the original CDN URL. */
export function thumbnailFallbackSrc(book: {
  thumbnail?: string;
  thumbnailLocal?: string;
}): string | null {
  if (book.thumbnailLocal && book.thumbnail) {
    return `/api/img-proxy?url=${encodeURIComponent(book.thumbnail)}`;
  }
  return null;
}

export function resolvedThumbnail(book: {
  thumbnail: string;
  thumbnailLocal?: string;
}): string {
  const assetBase = getAssetBaseUrl();

  if (book.thumbnailLocal) {
    const local = book.thumbnailLocal.startsWith("http")
      ? book.thumbnailLocal.replace(/^https?:\/\/[^/]+/, "")
      : book.thumbnailLocal;
    return `${assetBase}${local}`;
  }
  
  if (book.thumbnail.includes(MANGADEX_CDN)) {
    return `/api/img-proxy?url=${encodeURIComponent(book.thumbnail)}`;
  }

  return toRelativeProxyUrl(book.thumbnail);
}
