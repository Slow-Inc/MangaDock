import { cacheOrFetch, TTL } from "./apiCache";
import type { MangaDetail } from "./types";
import { HttpError } from "./httpError";

const API_BASE = "/api/proxy";

/**
 * Detail of a manga (covers / genres / authors / description), cached for TTL.LONG. The book
 * popup and the direct-link route that opens it both call this, so the second is a cache hit.
 *
 * Distinct `modal-detail` key (not the community page's `manga:{id}:detail`): that fetcher
 * caches null on !ok, which would poison a reader expecting a detail object. forceLocal gets
 * its own key because it changes the cover URLs.
 */
export function loadMangaDetail(id: string): Promise<MangaDetail> {
  const forceLocal = localStorage.getItem("imgCacheForceLocal") === "1";
  const qs = forceLocal ? "?forceLocal=true" : "";
  return cacheOrFetch<MangaDetail>(
    `manga:${id}:modal-detail${forceLocal ? ":local" : ""}`,
    () =>
      fetch(`${API_BASE}/books/manga/${encodeURIComponent(id)}${qs}`).then(async (r) => {
        if (!r.ok) throw new HttpError(r.status, "detail fetch failed"); // 404 vs failed load (#919)
        const d: MangaDetail = await r.json();
        // Guard the render's `[...detail.authors, ...detail.artists]` spread — a
        // 200-with-bad-shape must throw (not cache), else it would crash the
        // render for the whole TTL on every reopen.
        if (!Array.isArray(d.authors) || !Array.isArray(d.artists)) {
          throw new Error("detail shape invalid");
        }
        return d;
      }),
    TTL.LONG,
  );
}
