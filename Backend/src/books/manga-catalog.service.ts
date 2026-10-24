import {
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MangaDexService } from './mangadex.service';
import {
  CACHE_TTL_MS,
  type LandingBook,
  type MangaChapter,
  type MangaChapterPages,
  type MangaDetail,
  type MangaPreview,
} from './books.types';
import { OFF_SCOPE, type RatingScope } from '../common/content-rating';

const QUERY_CACHE_PREFIX = 'books:query:';
/** Year-range search scans upstream in MangaDex-max pages, capped (#661). */
const YEAR_SCAN_PAGE_SIZE = 100;
const YEAR_SCAN_MAX_PAGES = 10;

/**
 * MangaDex catalog passthrough + search carved out of BooksService (#231, PRD
 * #228 step 6). Owns the thin chapter/detail/preview/new-releases/genre
 * delegators to MangaDexService and the search path (MangaDex search +
 * user-uploaded alt-name enhancement via chapter_versions). Independent of the
 * MIT translation chain. Behaviour is byte-identical to the inline version it
 * replaces — BooksService keeps thin delegators so controllers are unchanged.
 */
export class MangaCatalogService {
  private readonly logger = new Logger(MangaCatalogService.name);

  constructor(
    private readonly mangaDex: MangaDexService,
    private readonly supabase: SupabaseService,
    private readonly cache: CacheOrchestratorService,
  ) {}

  getMangaChapters(
    mangaId: string,
    forceLocal = false,
    scope: RatingScope = OFF_SCOPE,
  ): Promise<MangaChapter[]> {
    return this.mangaDex.getMangaChapters(mangaId, forceLocal, scope);
  }

  getMangaChapterPages(
    chapterId: string,
    forceLocal = false,
  ): Promise<MangaChapterPages | null> {
    return this.mangaDex.getMangaChapterPages(chapterId, forceLocal);
  }

  getMangaPreview(
    mangaId: string,
    scope: RatingScope = OFF_SCOPE,
  ): Promise<MangaPreview | null> {
    return this.mangaDex.getMangaPreview(mangaId, scope);
  }

  getMangaDetail(mangaId: string, forceLocal = false): Promise<MangaDetail> {
    return this.mangaDex.getMangaDetail(mangaId, forceLocal);
  }

  getNewReleases(
    page = 1,
    limit = 28,
    tag?: string,
    scope: RatingScope = OFF_SCOPE,
  ) {
    return this.mangaDex.getNewReleases(page, limit, tag, scope);
  }

  getGenreManga(
    slug: string,
    page = 1,
    limit = 28,
    scope: RatingScope = OFF_SCOPE,
  ) {
    return this.mangaDex.getGenreManga(slug, page, limit, scope);
  }

  getContentRatings(ids: string[]) {
    return this.mangaDex.getContentRatings(ids);
  }

  async getRelated(id: string, limit = 10): Promise<LandingBook[]> {
    let genres: string[];
    try {
      const detail = await this.mangaDex.getMangaDetail(id);
      genres = detail.genres ?? [];
    } catch (err) {
      // Only an unknown id has no related titles; an outage must not read as "none" (#981)
      if (err instanceof NotFoundException) return [];
      throw err;
    }
    if (genres.length === 0) return [];

    const tagId = await this.mangaDex.getMangaTagId(genres[0]);
    if (!tagId) return [];

    const { items, unavailable } = await this.mangaDex.fetchMangaForRow(
      'rating',
      limit + 1,
      0,
      tagId,
    );
    if (unavailable)
      throw new ServiceUnavailableException('MangaDex related row unavailable');
    return items.filter((b) => b.id !== id).slice(0, limit);
  }

  async searchBooks(
    query: string,
    lang?: string,
    limit = 100,
    offset = 0,
    status?: 'ongoing' | 'completed' | 'hiatus',
    yearFrom?: number,
    yearTo?: number,
    scope: RatingScope = OFF_SCOPE,
  ): Promise<{ items: LandingBook[]; total: number }> {
    const cacheKey = `${QUERY_CACHE_PREFIX}${query
      .toLowerCase()
      .replace(
        /\s+/g,
        '_',
      )}${lang ? `:${lang}` : ''}${status ? `:${status}` : ''}${yearFrom != null ? `:yf${yearFrom}` : ''}${yearTo != null ? `:yt${yearTo}` : ''}:${offset}:${limit}${scope.key}`;

    const cached = await this.cache.get<{
      items: LandingBook[];
      total: number;
    }>(cacheKey);
    if (cached) {
      this.logger.log(
        `Search served from [${cached.source}] cache: "${query}" offset=${offset}`,
      );
      return cached.data;
    }

    const hasYearRange = yearFrom != null || yearTo != null;
    const inYearRange = (b: LandingBook) => {
      const year = parseInt(b.publishedDate ?? '', 10);
      if (isNaN(year)) return false;
      if (yearFrom != null && year < yearFrom) return false;
      if (yearTo != null && year > yearTo) return false;
      return true;
    };

    const result = hasYearRange
      ? await this.searchByYearRange(
          query,
          lang,
          limit,
          offset,
          status,
          inYearRange,
          scope,
        )
      : await this.searchPage(query, lang, limit, offset, status, scope);

    // Enhance: also match user-uploaded alt names in chapter_versions. First page only — appended to
    // every page they repeated on each one and pushed later pages past `limit` (#661).
    if (offset === 0) {
      try {
        const existingIds = new Set(result.items.map((b) => b.id));
        const altMatches = await this.findTitleIdsByAltName(query);
        const newIds = altMatches.filter((id) => !existingIds.has(id));
        if (newIds.length > 0) {
          let extra = await this.mangaDex.fetchMangaByIds(newIds, scope);
          if (hasYearRange) extra = extra.filter(inYearRange);
          result.items.push(...extra);
          result.total += extra.length;
          this.logger.log(
            `Alt-name search added ${extra.length} extra manga for "${query}"`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Alt-name lookup failed: ${(err as { message?: string })?.message ?? String(err)}`, // Supabase errors are plain objects
        );
      }
    }

    // A year-range miss costs up to YEAR_SCAN_MAX_PAGES upstream calls, so cache it too (#661);
    // other empty results stay uncached as before.
    if (result.items.length > 0 || hasYearRange) {
      await this.cache.set(cacheKey, result, CACHE_TTL_MS);
    }

    return result;
  }

  /**
   * MangaDex's `year` param takes a single year, so a range can't be pushed
   * upstream (#661). Scan upstream pages from offset 0 and filter locally until
   * one match past this page is found (so the next page stays reachable), the
   * upstream is exhausted, or the scan cap is hit. `total` is exact when the
   * scan exhausted upstream, otherwise a lower bound (> offset + limit unless the scan cap stopped it first).
   */
  private async searchByYearRange(
    query: string,
    lang: string | undefined,
    limit: number,
    offset: number,
    status: 'ongoing' | 'completed' | 'hiatus' | undefined,
    inYearRange: (b: LandingBook) => boolean,
    scope: RatingScope,
  ): Promise<{ items: LandingBook[]; total: number }> {
    const matches: LandingBook[] = [];
    for (
      let upstreamOffset = 0, page = 0;
      page < YEAR_SCAN_MAX_PAGES && matches.length <= offset + limit;
      page++, upstreamOffset += YEAR_SCAN_PAGE_SIZE
    ) {
      const { items, total } = await this.searchPage(
        query,
        lang,
        YEAR_SCAN_PAGE_SIZE,
        upstreamOffset,
        status,
        scope,
      );
      matches.push(...items.filter(inYearRange));
      if (
        items.length < YEAR_SCAN_PAGE_SIZE ||
        upstreamOffset + YEAR_SCAN_PAGE_SIZE >= total
      )
        break;
    }
    return {
      items: matches.slice(offset, offset + limit),
      total: matches.length,
    };
  }

  /**
   * One MangaDex search page. An outage is a 503, never an empty result: shown as "ไม่พบหนังสือ" and cached (a
   * year-range miss for 20 min), it hid the query long after MangaDex was back (#970).
   */
  private async searchPage(
    ...args: Parameters<MangaDexService['searchManga']>
  ): Promise<{ items: LandingBook[]; total: number }> {
    const { unavailable, ...page } = await this.mangaDex.searchManga(...args);
    if (unavailable)
      throw new ServiceUnavailableException('MangaDex search unavailable');
    return page;
  }

  /**
   * Budget for the alt-name lookup (#863). The Supabase client has no request timeout, so a slow upstream held every
   * uncached search for the full client timeout; this lookup only adds extra matches (best-effort, see searchBooks),
   * so it gives up instead. Scoped to this read — the client shared with auth and wallet is unchanged.
   */
  private altNameTimeoutMs = 3000;

  /** Query chapter_versions for title_name / title_alt_name matching the search query. */
  private async findTitleIdsByAltName(query: string): Promise<string[]> {
    const pattern = `%${query}%`;
    const { data, error } = await this.supabase.client
      .from('chapter_versions')
      .select('title_id')
      .or(`title_name.ilike.${pattern},title_alt_name.ilike.${pattern}`)
      .eq('status', 'published')
      .abortSignal(AbortSignal.timeout(this.altNameTimeoutMs));
    if (error) throw error;
    // Deduplicate title_ids
    return [...new Set((data ?? []).map((row: any) => row.title_id as string))];
  }
}
