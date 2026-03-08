export const CACHE_TTL_MS = 1000 * 60 * 20; // 20 minutes

export type MangaCover = {
  volume: string | null;
  url: string;
  /** Local /img-cache/… path when backend image cache is active. */
  localUrl?: string;
};

export type MangaDetail = {
  id: string;
  authors: string[];
  artists: string[];
  covers: MangaCover[];
  /** Genre tags extracted from MangaDex attributes (e.g. ["Romance", "Comedy"]) */
  genres: string[];
  /** Description extracted from MangaDex attributes */
  description?: string;
};

export type MangaPreview = {
  chapterId: string;
  chapterNumber: string | null;
  title: string | null;
  pages: string[];
  dataSaverPages: string[];
};

export type MangaChapter = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
  translatedLanguage: string;
  uploadedAt: string;
  pageCount: number;
  /** True if chapter has local page cache. */
  readerAvailable?: boolean;
  /** True if returned from stale cache because the upstream API went offline */
  isOfflineFallback?: boolean;
};

export type MangaChapterPages = {
  pages: string[];
  dataSaverPages: string[];
  /** Local /img-cache/… paths for pages (IMAGE_CACHE_ENABLED=true, may be partial). */
  localPages?: string[];
  localDataSaverPages?: string[];
  /**
   * Set to true/false only in forceLocal responses:
   * true  = at least one page is served from local cache
   * false = no pages are cached yet — frontend should show "not cached" UI
   */
  localCacheAvailable?: boolean;
};

export type LandingBook = {
  id: string;
  title: string;
  subtitle: string;
  authors: string[];
  description: string;
  thumbnail: string;
  /** Local /img-cache/… path when image has been cached on disk (IMAGE_CACHE_ENABLED=true). */
  thumbnailLocal?: string;
  /**
   * Set to true/false only in forceLocal responses:
   * true  = thumbnail is served from local cache
   * false = thumbnail not yet cached — frontend should show "not cached" placeholder
   */
  thumbnailCached?: boolean;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
};

export type LandingRow = {
  id: string;
  title: string;
  query: string;
  items: LandingBook[];
};

export type LandingPayload = {
  hero: LandingBook | null;
  rows: LandingRow[];
  updatedAt: string;
  /** true = data is from stale cache (upstream API was unavailable) */
  fromStaleCache?: boolean;
  /** ISO string of when the stale data was originally cached */
  staleUpdatedAt?: string;
  /** true = no cache at all and upstream API is offline */
  apiOffline?: boolean;
};
