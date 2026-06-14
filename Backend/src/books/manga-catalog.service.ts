import { Logger } from '@nestjs/common';
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

const QUERY_CACHE_PREFIX = 'books:query:';

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

  getMangaChapters(mangaId: string, forceLocal = false): Promise<MangaChapter[]> {
    return this.mangaDex.getMangaChapters(mangaId, forceLocal);
  }

  getMangaChapterPages(chapterId: string, forceLocal = false): Promise<MangaChapterPages | null> {
    return this.mangaDex.getMangaChapterPages(chapterId, forceLocal);
  }

  getMangaPreview(mangaId: string): Promise<MangaPreview | null> {
    return this.mangaDex.getMangaPreview(mangaId);
  }

  getMangaDetail(mangaId: string, forceLocal = false): Promise<MangaDetail> {
    return this.mangaDex.getMangaDetail(mangaId, forceLocal);
  }

  getNewReleases(page = 1, limit = 28, tag?: string) {
    return this.mangaDex.getNewReleases(page, limit, tag);
  }

  getGenreManga(slug: string, page = 1, limit = 28) {
    return this.mangaDex.getGenreManga(slug, page, limit);
  }

  async searchBooks(query: string, lang?: string, limit = 100, offset = 0): Promise<{ items: LandingBook[]; total: number }> {
    const cacheKey = `${QUERY_CACHE_PREFIX}${query
      .toLowerCase()
      .replace(/\s+/g, '_')}${lang ? `:${lang}` : ''}:${offset}:${limit}`;

    const cached = await this.cache.get<{ items: LandingBook[]; total: number }>(cacheKey);
    if (cached) {
      this.logger.log(`Search served from [${cached.source}] cache: "${query}" offset=${offset}`);
      return cached.data;
    }

    const result = await this.mangaDex.searchManga(query, lang, limit, offset);

    // Enhance: also match user-uploaded alt names in chapter_versions
    try {
      const existingIds = new Set(result.items.map((b) => b.id));
      const altMatches = await this.findTitleIdsByAltName(query);
      const newIds = altMatches.filter((id) => !existingIds.has(id));
      if (newIds.length > 0) {
        const extra = await this.mangaDex.fetchMangaByIds(newIds);
        result.items.push(...extra);
        result.total += extra.length;
        this.logger.log(`Alt-name search added ${extra.length} extra manga for "${query}"`);
      }
    } catch (err) {
      this.logger.warn(`Alt-name lookup failed: ${String(err)}`);
    }

    if (result.items.length > 0) {
      await this.cache.set(cacheKey, result, CACHE_TTL_MS);
    }

    return result;
  }

  /** Query chapter_versions for title_name / title_alt_name matching the search query. */
  private async findTitleIdsByAltName(query: string): Promise<string[]> {
    const pattern = `%${query}%`;
    const { data, error } = await this.supabase.client
      .from('chapter_versions')
      .select('title_id')
      .or(`title_name.ilike.${pattern},title_alt_name.ilike.${pattern}`)
      .eq('status', 'published');
    if (error) throw error;
    // Deduplicate title_ids
    return [...new Set((data ?? []).map((row: any) => row.title_id as string))];
  }
}
