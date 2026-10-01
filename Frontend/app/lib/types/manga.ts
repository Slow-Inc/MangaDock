export type MangaCover = {
  volume: string | null;
  url: string;
  localUrl?: string;
};

export type MangaDetail = {
  id: string;
  authors: string[];
  artists: string[];
  covers: MangaCover[];
  genres: string[];
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
  readerAvailable?: boolean;
  isOfflineFallback?: boolean;
  source?: "mangadex" | "user";
  translatorName?: string | null;
  priceCoins?: number;
  versionId?: string;
  backendAvailable?: boolean;
};

export type ActiveChapter = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
};

export type MangaChapterPages = {
  pages: string[];
  dataSaverPages: string[];
  localPages?: string[];
  localDataSaverPages?: string[];
  localCacheAvailable?: boolean;
};

export type LandingBook = {
  id: string;
  title: string;
  subtitle: string;
  authors: string[];
  description: string;
  thumbnail: string;
  thumbnailLocal?: string;
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
  fromStaleCache?: boolean;
  staleUpdatedAt?: string;
  apiOffline?: boolean;
};
