import { Injectable, Logger } from '@nestjs/common';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { ImageCacheService } from '../cache/image-cache.service';
import {
  CACHE_TTL_MS,
  type LandingBook,
  type MangaChapter,
  type MangaChapterPages,
  type MangaCover,
  type MangaDetail,
  type MangaPreview,
} from './books.types';

type MangaOrder = 'followedCount' | 'rating' | 'latestUploadedChapter' | 'createdAt';

type MangaDexManga = {
  id: string;
  attributes: {
    title?: Record<string, string>;
    description?: Record<string, string>;
    year?: number;
    tags?: Array<{ attributes?: { name?: Record<string, string> } }>;
  };
  relationships?: Array<{ type?: string; id?: string; attributes?: { fileName?: string; name?: string } }>;
};

type MangaDexCoverResponse = {
  data?: Array<{
    id: string;
    attributes: {
      volume?: string | null;
      fileName: string;
    };
    relationships?: Array<{ type?: string; id?: string }>;
  }>;
};

type MangaDexResponse = {
  data?: MangaDexManga[];
};

/** MangaDex tag slug → UUID map. */
const MANGA_GENRE_TAGS: Record<string, string> = {
  action:          '391b0423-d847-456f-aff0-8b0cfc03066b',
  adventure:       '87cc87cd-a395-47af-b27a-93258283bbc6',
  comedy:          '4d32cc48-9f00-4cbe-9bc4-f38aa0f8e2ac',
  romance:         '423e2eae-a7a2-4a8b-ac03-a8351462d71d',
  fantasy:         'cdc58593-87dd-415e-bbc0-2ec27bf404cc',
  drama:           'b9af3a63-f058-46de-a9a0-e0c13906197a',
  horror:          'cdad7e68-1419-41dd-bdce-27753074a640',
  'sci-fi':        '256c8bd9-4904-4360-bf4f-508a76d67183',
  'slice-of-life': 'e5301a23-ebd9-49dd-a0cb-2add944c7fe9',
  sports:          '69964a64-2f90-4d33-beeb-f3ed2875eb4c',
  mystery:         'ee968100-4191-4968-93d3-f82d72be7e46',
  psychological:   '3b60b75c-a2d7-4860-ab56-05f391bb889c',
  supernatural:    'eabc5b4c-6aff-42f3-b657-3e90cbd00b75',
  historical:      '33771934-028e-4cb3-8744-691e866a923e',
  isekai:          'ace04997-f6bd-436e-b261-779182193d3d',
  mecha:           '50880a9d-5440-4732-9afb-8f457127e836',
  'school-life':   'caaa44eb-cd40-4177-b930-79d3ef2aeeb2',
  thriller:        '07251805-a27e-4d59-b488-f0bfbec15168',
};

import { StatusService } from '../status/status.service';

@Injectable()
export class MangaDexService {
  private readonly logger = new Logger(MangaDexService.name);

  readonly mangaRowDefs: Array<{ id: string; title: string; order: MangaOrder; limit?: number }> = [
    { id: 'popular',   title: 'มังงะยอดนิยม',     order: 'followedCount',         limit: 20 },
    { id: 'top-rated', title: 'มังงะเรตติ้งสูง', order: 'rating',                limit: 20 },
    { id: 'latest',    title: 'อัปเดตล่าสุด',     order: 'latestUploadedChapter', limit: 20 },
    { id: 'new',       title: 'มังงะมาใหม่',     order: 'createdAt',             limit: 20 },
  ];

  constructor(
    private readonly cache: CacheOrchestratorService,
    private readonly imageCache: ImageCacheService,
    private readonly statusService: StatusService,
  ) {}

  private get backendOrigin(): string {
    return (
      process.env.BACKEND_PUBLIC_ORIGIN ??
      `http://localhost:${process.env.PORT ?? 3001}`
    );
  }

  private getMangaLanguage(): string {
    return (process.env.MANGADEX_LANG ?? 'th').toLowerCase();
  }

  // Tests can override: (service as any).fetchFn = mockFetch
  private fetchFn: typeof fetch = (...args: Parameters<typeof fetch>) => fetch(...args);

  private mangadexFetch(url: string): Promise<Response> {
    return this.fetchFn(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MangaDock/1.0 (+https://2552667.xyz)',
      },
      cache: 'no-store',
    });
  }

  async getMangaChapters(mangaId: string, forceLocal = false): Promise<MangaChapter[]> {
    // v3: uses pagination to fetch ALL chapters (supports decimal sub-chapters like 13.1, 13.2)
    const cacheKey = `manga:chapters:v3:${mangaId}`;
    const cached = await this.cache.get<MangaChapter[]>(cacheKey);
    if (cached) {
      return await this.attachLocalStatus(cached.data, false, forceLocal);
    }

    const lang = this.getMangaLanguage();
    const PAGE_SIZE = 500; // MangaDex max per request

    type MdChapter = {
      id: string;
      attributes: {
        chapter?: string | null;
        title?: string | null;
        translatedLanguage?: string;
        publishAt?: string;
        pages?: number;
      };
    };

    try {
      const allItems: MdChapter[] = [];
      let offset = 0;
      let total = Infinity;

      while (offset < total) {
        const params = new URLSearchParams();
        params.append('translatedLanguage[]', lang);
        params.append('translatedLanguage[]', 'en');
        params.set('order[chapter]', 'asc');
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(offset));
        params.append('contentRating[]', 'safe');
        params.append('contentRating[]', 'suggestive');

        const res = await this.mangadexFetch(
          `https://api.mangadex.org/manga/${mangaId}/feed?${params.toString()}`,
        );
        if (!res.ok) break;

        const data = (await res.json()) as { total?: number; data?: MdChapter[] };
        const items = data.data ?? [];
        allItems.push(...items);

        if (total === Infinity) total = data.total ?? 0;
        offset += items.length;
        if (items.length < PAGE_SIZE) break; // no more pages
      }

      let chapters: MangaChapter[] = allItems.map((c) => ({
        id: c.id,
        chapterNumber: c.attributes.chapter ?? null,
        title: c.attributes.title ?? null,
        translatedLanguage: c.attributes.translatedLanguage ?? 'en',
        uploadedAt: c.attributes.publishAt ?? '',
        pageCount: c.attributes.pages ?? 0,
      }));

      if (chapters.length > 0) {
        await this.cache.set(cacheKey, chapters, CACHE_TTL_MS);
      } else {
        this.logger.warn('[MangaDex] Chapters empty — attempting stale cache fallback');
        const stale = this.cache.getStale<MangaChapter[]>(cacheKey);
        if (stale) {
          this.logger.log(`[MangaDex] Serving stale chapters cache (updatedAt=${stale.updatedAt})`);
          return this.attachLocalStatus(stale.data, true, forceLocal);
        }
      }

      return this.attachLocalStatus(chapters, false, forceLocal);
    } catch (err) {
      this.logger.error(`[MangaDex] Chapters fetch error: ${String(err)}`);
      const stale = this.cache.getStale<MangaChapter[]>(cacheKey);
      if (stale) {
        this.logger.log(`[MangaDex] Serving stale chapters cache (updatedAt=${stale.updatedAt})`);
        return this.attachLocalStatus(stale.data, true, forceLocal);
      }
      return [];
    }
  }

  async getMangaChapterPages(chapterId: string, forceLocal = false): Promise<MangaChapterPages | null> {
    const cacheKey = `manga:chapter-pages:${chapterId}`;
    const cached = await this.cache.get<MangaChapterPages>(cacheKey);
    if (cached) {
      const enhanced = await this.enhanceChapterPages(chapterId, cached.data);
      if (this.imageCache.enabled) {
        this.patchChapterPagesCacheIfNeeded(cacheKey, cached.data, enhanced);
      }
      return forceLocal ? this.applyForceLocalChapterPages(enhanced) : enhanced;
    }

    try {
      const res = await this.mangadexFetch(
        `https://api.mangadex.org/at-home/server/${chapterId}`,
      );
      if (!res.ok) {
        const stale = this.cache.getStale<MangaChapterPages>(cacheKey);
        if (stale) {
          this.logger.log(`[MangaDex] Serving stale chapter-pages cache chapter=${chapterId} updatedAt=${stale.updatedAt}`);
          const enhanced = await this.enhanceChapterPages(chapterId, stale.data);
          return forceLocal ? this.applyForceLocalChapterPages(enhanced) : enhanced;
        }
        return null;
      }

      const data = (await res.json()) as {
        baseUrl: string;
        chapter: { hash: string; data: string[]; dataSaver: string[] };
      };

      const { baseUrl, chapter } = data;
      const result: MangaChapterPages = {
        pages: chapter.data.map((f) => `${baseUrl}/data/${chapter.hash}/${f}`),
        dataSaverPages: chapter.dataSaver.map((f) => `${baseUrl}/data-saver/${chapter.hash}/${f}`),
      };

      await this.cache.set(cacheKey, result, CACHE_TTL_MS);
      const chapterEnhanced = await this.enhanceChapterPages(chapterId, result);
      return forceLocal ? this.applyForceLocalChapterPages(chapterEnhanced) : chapterEnhanced;
    } catch (err) {
      this.logger.error(`[MangaDex] Chapter pages fetch error: ${String(err)}`);
      const stale = this.cache.getStale<MangaChapterPages>(cacheKey);
      if (stale) {
        this.logger.log(`[MangaDex] Serving stale chapter-pages cache chapter=${chapterId} updatedAt=${stale.updatedAt}`);
        const enhanced = await this.enhanceChapterPages(chapterId, stale.data);
        return forceLocal ? this.applyForceLocalChapterPages(enhanced) : enhanced;
      }
      return null;
    }
  }

  async getMangaPreview(mangaId: string): Promise<MangaPreview | null> {
    const cacheKey = `manga:preview:${mangaId}`;
    const cached = await this.cache.get<MangaPreview | null>(cacheKey);
    if (cached) return cached.data;

    const lang = this.getMangaLanguage();
    try {
      const feedParams = new URLSearchParams();
      feedParams.append('translatedLanguage[]', lang);
      feedParams.append('translatedLanguage[]', 'en'); // fallback to english
      feedParams.set('order[chapter]', 'asc');
      feedParams.set('limit', '5');
      feedParams.append('contentRating[]', 'safe');
      feedParams.append('contentRating[]', 'suggestive');

      const feedRes = await this.mangadexFetch(
        `https://api.mangadex.org/manga/${mangaId}/feed?${feedParams.toString()}`,
      );
      if (!feedRes.ok) {
        await this.cache.set(cacheKey, null, CACHE_TTL_MS);
        return null;
      }

      const feedData = (await feedRes.json()) as {
        data?: Array<{
          id: string;
          attributes: { chapter?: string | null; title?: string | null; translatedLanguage?: string };
        }>;
      };

      const chapters = feedData.data ?? [];
      const preferredChapter =
        chapters.find((c) => c.attributes.translatedLanguage === lang) ?? chapters[0];

      if (!preferredChapter) {
        await this.cache.set(cacheKey, null, CACHE_TTL_MS);
        return null;
      }

      const atHomeRes = await this.mangadexFetch(
        `https://api.mangadex.org/at-home/server/${preferredChapter.id}`,
      );
      if (!atHomeRes.ok) {
        await this.cache.set(cacheKey, null, CACHE_TTL_MS);
        return null;
      }

      const atHomeData = (await atHomeRes.json()) as {
        baseUrl: string;
        chapter: { hash: string; data: string[]; dataSaver: string[] };
      };

      const { baseUrl, chapter } = atHomeData;
      const pages = chapter.data.map((f) => `${baseUrl}/data/${chapter.hash}/${f}`);
      const dataSaverPages = chapter.dataSaver.map(
        (f) => `${baseUrl}/data-saver/${chapter.hash}/${f}`,
      );

      const preview: MangaPreview = {
        chapterId: preferredChapter.id,
        chapterNumber: preferredChapter.attributes.chapter ?? null,
        title: preferredChapter.attributes.title ?? null,
        pages,
        dataSaverPages,
      };

      await this.cache.set(cacheKey, preview, CACHE_TTL_MS);
      return preview;
    } catch (err) {
      this.logger.error(`[MangaDex] Preview fetch error: ${String(err)}`);
      return null;
    }
  }

  async getMangaDetail(mangaId: string, forceLocal = false): Promise<MangaDetail> {
    const cacheKey = `manga:detail:${mangaId}`;
    const cached = await this.cache.get<MangaDetail>(cacheKey);
    if (cached) {
      const enhanced = await this.enhanceMangaDetail(mangaId, cached.data);
      if (this.imageCache.enabled) {
        this.patchMangaDetailCacheIfNeeded(cacheKey, cached.data, enhanced);
      }
      return forceLocal ? this.applyForceLocalMangaDetail(enhanced) : enhanced;
    }

    const [coversData, authorsData] = await Promise.allSettled([
      this.fetchMangaCovers(mangaId),
      this.fetchMangaAuthors(mangaId),
    ]);

    const covers = coversData.status === 'fulfilled' ? coversData.value : [];
    const { title, authors, artists, genres, description } = authorsData.status === 'fulfilled'
      ? authorsData.value
      : { title: '', authors: [], artists: [], genres: [], description: '' };

    const detail: MangaDetail = { id: mangaId, ...(title ? { title } : {}), authors, artists, covers, genres, description };

    const hasUsefulData =
      detail.covers.length > 0 ||
      detail.authors.length > 0 ||
      detail.artists.length > 0 ||
      detail.genres.length > 0 ||
      !!detail.description;

    if (hasUsefulData) {
      await this.cache.set(cacheKey, detail, CACHE_TTL_MS);
      const enhanced = await this.enhanceMangaDetail(mangaId, detail);
      return forceLocal ? this.applyForceLocalMangaDetail(enhanced) : enhanced;
    }

    this.logger.warn('[MangaDex] Manga detail empty — attempting stale cache fallback');
    const stale = this.cache.getStale<MangaDetail>(cacheKey);
    if (stale) {
      this.logger.log(`[MangaDex] Serving stale manga-detail cache (updatedAt=${stale.updatedAt})`);
      const enhanced = await this.enhanceMangaDetail(mangaId, stale.data);
      return forceLocal ? this.applyForceLocalMangaDetail(enhanced) : enhanced;
    }

    return detail;
  }

  async getNewReleases(page = 1, limit = 28, tag?: string): Promise<{
    new: { items: LandingBook[]; total: number };
    latest: { items: LandingBook[]; total: number };
    popular: { items: LandingBook[]; total: number };
    'top-rated': { items: LandingBook[]; total: number };
  }> {
    const offset = (page - 1) * limit;
    const tagId = tag ? await this.getMangaTagId(tag) : undefined;
    const cacheKey = `new-releases:v3:${page}:${limit}${tagId ? `:tag:${tagId}` : ''}`;
    const cached = await this.cache.get<{
      new: { items: LandingBook[]; total: number };
      latest: { items: LandingBook[]; total: number };
      popular: { items: LandingBook[]; total: number };
      'top-rated': { items: LandingBook[]; total: number };
    }>(cacheKey);
    if (cached) return cached.data;

    const [newResult, latestResult, popularResult, topRatedResult] = await Promise.all([
      this.fetchMangaForRow('createdAt', limit, offset, tagId),
      this.fetchMangaForRow('latestUploadedChapter', limit, offset, tagId),
      this.fetchMangaForRow('followedCount', limit, offset, tagId),
      this.fetchMangaForRow('rating', limit, offset, tagId),
    ]);

    const result = {
      new: newResult,
      latest: latestResult,
      popular: popularResult,
      'top-rated': topRatedResult,
    };
    if (newResult.items.length > 0 || latestResult.items.length > 0) {
      await this.cache.set(cacheKey, result, CACHE_TTL_MS);
    }
    return result;
  }

  async getGenreManga(slug: string, page = 1, limit = 28): Promise<{ items: LandingBook[]; total: number; slug: string }> {
    const tagId = MANGA_GENRE_TAGS[slug];
    if (!tagId) return { items: [], total: 0, slug };

    const offset = (page - 1) * limit;
    const cacheKey = `genre:${slug}:${page}:${limit}`;
    const cached = await this.cache.get<{ items: LandingBook[]; total: number; slug: string }>(cacheKey);
    if (cached) return cached.data;

    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    params.append('includes[]', 'cover_art');
    params.append('includedTags[]', tagId);
    params.append('availableTranslatedLanguage[]', this.getMangaLanguage());
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.set('order[followedCount]', 'desc');

    try {
      const response = await this.mangadexFetch(`https://api.mangadex.org/manga?${params.toString()}`);
      if (!response.ok) return { items: [], total: 0, slug };
      const data = (await response.json()) as MangaDexResponse & { total?: number };
      const items = this.mapManga(data);
      const total = (data as any).total ?? items.length;
      const result = { items, total, slug };
      await this.cache.set(cacheKey, result, 1000 * 60 * 15);
      return result;
    } catch (err) {
      this.logger.warn(`[MangaDex] Genre fetch error (${slug}): ${String(err)}`);
      return { items: [], total: 0, slug };
    }
  }

  async searchManga(query: string, lang?: string, limit = 100, offset = 0, status?: 'ongoing' | 'completed' | 'hiatus'): Promise<{ items: LandingBook[]; total: number }> {
    const params = new URLSearchParams();
    params.set('limit', String(Math.min(limit, 100))); // MangaDex API max is 100
    params.set('offset', String(offset));
    params.set('title', query);
    params.append('includes[]', 'cover_art');
    if (lang) params.append('availableTranslatedLanguage[]', lang);
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    if (status) params.append('status[]', status);

    return this.fetchMangaWithParamsPaged(params, `search:${query}${lang ? `:${lang}` : ''}${status ? `:${status}` : ''}`);
  }

  /** Fetch specific manga by IDs and return as LandingBook[]. */
  async fetchMangaByIds(ids: string[]): Promise<LandingBook[]> {
    if (!ids.length) return [];
    const params = new URLSearchParams();
    for (const id of ids) params.append('ids[]', id);
    params.set('limit', String(ids.length));
    params.append('includes[]', 'cover_art');
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.append('contentRating[]', 'erotica');
    const { items } = await this.fetchMangaWithParamsPaged(params, `byIds:${ids.length}`);
    return items;
  }

  async fetchMangaForRow(order: MangaOrder, limit = 10, offset = 0, tagId?: string): Promise<{ items: LandingBook[]; total: number }> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (offset > 0) params.set('offset', String(offset));
    params.append('includes[]', 'cover_art');
    params.append('availableTranslatedLanguage[]', this.getMangaLanguage());
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.set(`order[${order}]`, 'desc');
    if (tagId) params.append('includedTags[]', tagId);

    return this.fetchMangaWithParamsPaged(params, `row:${order}${tagId ? `:tag:${tagId}` : ''}`);
  }

  async getMangaTagId(tagName: string): Promise<string | undefined> {
    const cacheKey = 'mangadex:tags:v1';
    const cached = await this.cache.get<Record<string, string>>(cacheKey);
    if (cached) return cached.data[tagName];

    try {
      const res = await this.mangadexFetch('https://api.mangadex.org/manga/tag');
      if (!res.ok) return undefined;
      const json = await res.json() as { data: { id: string; attributes: { name: { en?: string } } }[] };
      const map: Record<string, string> = {};
      for (const tag of json.data) {
        const name = tag.attributes?.name?.en;
        if (name) map[name] = tag.id;
      }
      await this.cache.set(cacheKey, map, 1000 * 60 * 60 * 24); // 24h
      return map[tagName];
    } catch (err) {
      this.logger.warn(`[MangaDex] Tag list fetch error: ${String(err)}`);
      return undefined;
    }
  }

  private async fetchMangaCovers(mangaId: string): Promise<MangaCover[]> {
    try {
      const params = new URLSearchParams();
      params.append('manga[]', mangaId);
      params.set('limit', '100');
      params.set('order[volume]', 'asc');

      const res = await this.mangadexFetch(`https://api.mangadex.org/cover?${params.toString()}`);
      if (!res.ok) return [];

      const data = (await res.json()) as MangaDexCoverResponse;
      return (
        data.data
          ?.map((cover) => ({
            volume: cover.attributes.volume ?? null,
            url: `https://uploads.mangadex.org/covers/${mangaId}/${cover.attributes.fileName}.512.jpg`,
          })) ?? []
      );
    } catch (err) {
      this.logger.warn(`[MangaDex] Covers fetch error (${mangaId}): ${String(err)}`);
      return [];
    }
  }

  private async fetchMangaAuthors(mangaId: string): Promise<{ title: string; authors: string[]; artists: string[]; genres: string[]; description: string }> {
    try {
      const params = new URLSearchParams();
      params.append('includes[]', 'author');
      params.append('includes[]', 'artist');

      const res = await this.mangadexFetch(`https://api.mangadex.org/manga/${mangaId}?${params.toString()}`);
      if (!res.ok) return { title: '', authors: [], artists: [], genres: [], description: '' };

      const data = (await res.json()) as { data?: MangaDexManga };
      const rels = data.data?.relationships ?? [];
      const authors = rels
        .filter((r) => r.type === 'author')
        .map((r) => r.attributes?.name ?? '')
        .filter(Boolean);
      const artists = rels
        .filter((r) => r.type === 'artist')
        .map((r) => r.attributes?.name ?? '')
        .filter(Boolean);
      const genres = (data.data?.attributes?.tags ?? [])
        .map((t) => t.attributes?.name?.en ?? '')
        .filter(Boolean)
        .slice(0, 5);

      const lang = this.getMangaLanguage();
      const description = this.pickLocalized(data.data?.attributes?.description, lang);
      // Series title anchors the translator's series context (#157).
      const title = this.pickLocalized(data.data?.attributes?.title, lang);

      return { title, authors, artists, genres, description: description || '' };
    } catch (err) {
      this.logger.warn(`[MangaDex] Authors fetch error (${mangaId}): ${String(err)}`);
      return { title: '', authors: [], artists: [], genres: [], description: '' };
    }
  }

  private async fetchMangaWithParamsPaged(params: URLSearchParams, label: string): Promise<{ items: LandingBook[]; total: number }> {
    const lang = this.getMangaLanguage();
    this.logger.log(`[MangaDex] Fetching: ${label} | lang=${lang}`);

    try {
      const response = await this.mangadexFetch(`https://api.mangadex.org/manga?${params.toString()}`);

      this.logger.log(`[MangaDex] ${response.status} ${response.statusText} | ${label}`);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        if (text.includes('href="/maintenance-')) {
          this.logger.error(`[MangaDex] MangaDex API กำลังปิดปรับปรุง`);
          this.statusService.broadcastStatus('mangadex', 'maintenance');
        } else {
          this.logger.error(`[MangaDex] Error: ${text.substring(0, 200)}`);
          this.statusService.broadcastStatus('mangadex', 'offline');
        }
        return { items: [], total: 0 };
      }

      const data = (await response.json()) as MangaDexResponse & { total?: number };
      const items = this.mapManga(data);
      const total = (data as any).total ?? items.length;
      this.logger.log(`[MangaDex] Found ${items.length}/${total} manga for ${label}`);
      
      this.statusService.broadcastStatus('mangadex', 'online');
      
      return { items, total };
    } catch (err) {
      this.logger.error(`[MangaDex] Fetch error: ${String(err)}`);
      this.statusService.broadcastStatus('mangadex', 'offline');
      return { items: [], total: 0 };
    }
  }

  private mapManga(data: MangaDexResponse): LandingBook[] {
    const lang = this.getMangaLanguage();
    return (
      data.data
        ?.map((manga) => {
          const title = this.pickLocalized(manga.attributes?.title, lang);
          const description = this.pickLocalized(manga.attributes?.description, lang);
          const tags =
            manga.attributes?.tags
              ?.map((tag) => this.pickLocalized(tag.attributes?.name, lang))
              .filter((tag): tag is string => Boolean(tag)) ?? [];
          const coverFile = manga.relationships?.find((rel) => rel.type === 'cover_art')
            ?.attributes?.fileName;

          if (!manga.id || !title || !coverFile) return null;

          const thumbnail = `https://uploads.mangadex.org/covers/${manga.id}/${coverFile}.512.jpg`;

          return {
            id: manga.id,
            title,
            subtitle: '',
            authors: [] as string[],
            description: description ?? '',
            thumbnail,
            publishedDate: manga.attributes?.year ? String(manga.attributes.year) : '',
            categories: tags.slice(0, 3),
            averageRating: 0,
            ratingsCount: 0,
          } satisfies LandingBook;
        })
        .filter((b): b is LandingBook => b !== null) ?? []
    );
  }

  private pickLocalized(value: Record<string, string> | undefined, lang: string): string {
    if (!value || Object.keys(value).length === 0) return '';
    return value[lang] ?? value.en ?? Object.values(value)[0] ?? '';
  }

  // ─── Image cache enhancement ─────────────────────────────────────────────────

  private async attachLocalStatus(chapters: MangaChapter[], isOfflineFallback = false, forceLocal = false): Promise<MangaChapter[]> {
    // readerAvailable is only consumed by the UI under forceLocal (offline toggle) or
    // isOfflineFallback (stale cache served while MangaDex is down) — see
    // HeroDetailButton.tsx:33 and BookDetailModal's chapterNeedsBackup === isOfflineFallback.
    // Computing it otherwise fires one Cloudflare Worker GET /v1/list per chapter, so an
    // N-chapter manga cost N Class-A R2 list ops on EVERY chapter-list load (incl. cache
    // hits). Skip the fan-out unless the result will actually be read.
    if (!this.imageCache.enabled || (!forceLocal && !isOfflineFallback)) {
      return chapters.map((ch) => ({ ...ch, readerAvailable: false, isOfflineFallback }));
    }

    return await Promise.all(
      chapters.map(async (ch) => ({
        ...ch,
        readerAvailable: await this.imageCache.hasChapterCache('_chapters', ch.id),
        isOfflineFallback
      }))
    );
  }

  private applyForceLocalMangaDetail(detail: MangaDetail): MangaDetail {
    if (!this.imageCache.enabled) return detail;
    const origin = this.backendOrigin;
    return {
      ...detail,
      covers: detail.covers.map((c) => ({
        ...c,
        url: c.localUrl ? `${origin}${c.localUrl}` : c.url,
      })),
    };
  }

  private async enhanceMangaDetail(mangaId: string, detail: MangaDetail): Promise<MangaDetail> {
    if (!this.imageCache.enabled || detail.covers.length === 0) return detail;

    // Don't trust cached localUrls blindly — files may have been wiped on
    // restart/reset, which would 404 from the static /img-cache route.
    // localCoverPaths re-checks existence (one batched list per manga, and
    // re-triggers downloads for missing ones), so always re-resolve from the
    // original external urls.
    const coverUrls = detail.covers.map((c) => c.url);
    const localPaths = await this.imageCache.localCoverPaths(mangaId, coverUrls);
    return {
      ...detail,
      covers: detail.covers.map((c, i) => ({
        ...c,
        localUrl: localPaths[i].startsWith('/img-cache') ? localPaths[i] : undefined,
      })),
    };
  }

  private patchMangaDetailCacheIfNeeded(
    cacheKey: string,
    original: MangaDetail,
    enhanced: MangaDetail,
  ): void {
    const origLocal = original.covers.filter((c) => c.localUrl).length;
    const newLocal = enhanced.covers.filter((c) => c.localUrl).length;
    if (newLocal <= origLocal) return;
    this.logger.log(
      `[ImageCache] Patching manga-detail cache — ${newLocal - origLocal} new local cover(s) added`,
    );
    this.cache
      .set(cacheKey, enhanced, CACHE_TTL_MS)
      .catch((err) =>
        this.logger.warn(`[ImageCache] Manga-detail cache patch failed: ${String(err)}`),
      );
  }

  private applyForceLocalChapterPages(data: MangaChapterPages): MangaChapterPages {
    if (!this.imageCache.enabled) return data;
    const origin = this.backendOrigin;
    const resolve = (locals: string[] | undefined, originals: string[]) => {
      if (!locals) return originals;
      return locals.map((p, i) =>
        p.startsWith('/img-cache') ? `${origin}${p}` : (originals[i] ?? p),
      );
    };
    const resolvedPages = resolve(data.localPages, data.pages);
    const resolvedDataSaver = resolve(data.localDataSaverPages, data.dataSaverPages);
    const localCacheAvailable =
      resolvedPages.some((p) => p.startsWith(origin)) ||
      resolvedDataSaver.some((p) => p.startsWith(origin));
    return {
      ...data,
      pages: resolvedPages,
      dataSaverPages: resolvedDataSaver,
      localCacheAvailable,
    };
  }

  private patchChapterPagesCacheIfNeeded(
    cacheKey: string,
    original: MangaChapterPages,
    enhanced: MangaChapterPages,
  ): void {
    const countLocal = (arr: string[] | undefined) =>
      (arr ?? []).filter((p) => p.startsWith('/img-cache')).length;

    const origLocal =
      countLocal(original.localPages) + countLocal(original.localDataSaverPages);
    const newLocal =
      countLocal(enhanced.localPages) + countLocal(enhanced.localDataSaverPages);

    if (newLocal <= origLocal) return;

    const gained = newLocal - origLocal;
    this.logger.log(
      `[ImageCache] Patching chapter-pages cache — ${gained} new local page(s) added`,
    );
    this.cache
      .set(cacheKey, enhanced, CACHE_TTL_MS)
      .catch((err) =>
        this.logger.warn(`[ImageCache] Chapter cache patch failed: ${String(err)}`),
      );
  }

  private async enhanceChapterPages(
    chapterId: string,
    data: MangaChapterPages,
  ): Promise<MangaChapterPages> {
    if (!this.imageCache.enabled) return data;

    // Don't short-circuit on cached localPages/localDataSaverPages — those paths
    // may point to files wiped on restart/reset, which would 404 from the static
    // /img-cache route. localPagePaths re-checks existence (one batched list
    // per chapter, and re-triggers downloads for missing ones), so always
    // re-resolve.
    const [localPages, localDataSaverPages] = await Promise.all([
      this.imageCache.localPagePaths(
        '_chapters',
        chapterId,
        data.pages,
        'p',
      ),
      this.imageCache.localPagePaths(
        '_chapters',
        chapterId,
        data.dataSaverPages,
        'ds',
      ),
    ]);
    return { ...data, localPages, localDataSaverPages };
  }
}
