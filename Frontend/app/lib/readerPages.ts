import type { ChapterPageItem } from "../hooks/useChapters";

/**
 * Resolve the display URL for each page (extracted from MangaReader #582).
 * Already-proxied /api/ URLs pass through; locally-cached /img-cache paths are
 * prefixed with the backend base; everything else is routed through the
 * img-proxy (encoded) so the browser never hits the MangaDex CDN directly.
 */
export function resolveReaderPages(
  originals: string[],
  locals: string[] | undefined,
  apiBase: string,
): string[] {
  return originals.map((orig, i) => {
    if (orig.startsWith("/api/")) return orig;
    const local = locals?.[i];
    if (local && local.startsWith("/img-cache")) return `${apiBase}${local}`;
    return `/api/img-proxy?url=${encodeURIComponent(orig)}`;
  });
}

/**
 * For each OTHER language, the first chapter after the current position whose
 * chapter number is strictly higher (extracted from MangaReader). The current
 * language is excluded.
 */
export function buildOtherLangNextMap(
  chapterList: ChapterPageItem[],
  currentIdx: number,
  currentChapterNum: string | null,
  currentLang: string | null,
): Map<string, ChapterPageItem> {
  if (currentIdx < 0) return new Map<string, ChapterPageItem>();
  const map = new Map<string, ChapterPageItem>();
  for (const ch of chapterList.slice(currentIdx + 1)) {
    if (currentChapterNum !== null && ch.chapterNumber !== null) {
      if (parseFloat(ch.chapterNumber) <= parseFloat(currentChapterNum)) continue;
    }
    if (!map.has(ch.translatedLanguage)) map.set(ch.translatedLanguage, ch);
  }
  if (currentLang) map.delete(currentLang);
  return map;
}
