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

/** MangaDex CDN hostname — images from here get proxied through our backend. */
const MANGADEX_CDN = "uploads.mangadex.org";

/**
 * Strip any hardcoded backend origin (http://localhost:PORT or http://hostname:PORT)
 * from a URL and replace with the frontend-relative proxy path.
 * This ensures images work correctly when the app is accessed from any device,
 * not just localhost.
 */
export function toRelativeProxyUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('/uploads/') || url.startsWith('/img-cache/')) {
    return `${API_BASE}${url}`;
  }
  try {
    const parsed = new URL(url);
    const pathWithQuery = `${parsed.pathname}${parsed.search}`;
    if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/img-cache/')) {
      return `${API_BASE}${pathWithQuery}`;
    }
    if (parsed.protocol === 'http:') {
      return `${API_BASE}${pathWithQuery}`;
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

export function resolvedThumbnail(book: {
  thumbnail: string;
  thumbnailLocal?: string;
}): string {
  if (book.thumbnailLocal) {
    // thumbnailLocal may be stored as a full URL (e.g. http://localhost:3001/img-cache/...)
    // from older history entries — strip the origin so we always get a relative path.
    const local = book.thumbnailLocal.startsWith("http")
      ? book.thumbnailLocal.replace(/^https?:\/\/[^/]+/, "")
      : book.thumbnailLocal;
    return `${API_BASE}${local}`;
  }
  // Route MangaDex images through our Next.js API proxy (relative URL — works on any host)
  if (book.thumbnail.includes(MANGADEX_CDN)) {
    return `/api/img-proxy?url=${encodeURIComponent(book.thumbnail)}`;
  }
  // Convert any http://localhost:* or http://hostname:* URLs to relative proxy paths
  // so they work when the app is accessed from other devices on the network.
  return toRelativeProxyUrl(book.thumbnail);
}
