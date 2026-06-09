import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service';

/** One rendered region's source + translated text (#158 text layer). */
export interface TextLayerRegion {
  src: string;
  dst: string;
}

/**
 * Translation memory persistence (#160, PRD #155 P3).
 *
 * A best-effort wrapper over the server-only Supabase tables: every write is
 * try/caught and returns a boolean — a persistence failure is logged and never
 * propagates, so translation never depends on it (local-first rule).
 */
@Injectable()
export class TranslationMemoryRepository {
  private readonly logger = new Logger(TranslationMemoryRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Upsert a page's text layer; idempotent on (chapter, page, lang). */
  async savePageText(
    chapterId: string,
    pageIndex: number,
    targetLang: string,
    regions: TextLayerRegion[],
    model?: string,
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase.client
        .from('chapter_page_texts')
        .upsert(
          {
            chapter_id: chapterId,
            page_index: pageIndex,
            target_lang: targetLang,
            regions,
            model: model ?? null,
          },
          { onConflict: 'chapter_id,page_index,target_lang' },
        );
      if (error) {
        this.logger.warn(`savePageText failed (${chapterId} p${pageIndex}): ${error.message}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`savePageText threw (${chapterId} p${pageIndex}): ${String(e)}`);
      return false;
    }
  }

  /** Upsert a series glossary. An `auto` write is skipped when the stored row
   *  was human-edited (`source='edited'`) — curation is never auto-overwritten.
   *  An explicit `edited` write always wins. Best-effort. */
  async upsertGlossary(
    mangaId: string,
    targetLang: string,
    glossary: Record<string, string>,
    source: 'auto' | 'edited' = 'auto',
  ): Promise<boolean> {
    try {
      if (source === 'auto') {
        const { data } = await this.supabase.client
          .from('manga_glossaries')
          .select('source')
          .eq('manga_id', mangaId)
          .eq('target_lang', targetLang)
          .maybeSingle();
        if (data?.source === 'edited') return false;
      }
      const { error } = await this.supabase.client
        .from('manga_glossaries')
        .upsert(
          {
            manga_id: mangaId,
            target_lang: targetLang,
            glossary,
            source,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'manga_id,target_lang' },
        );
      if (error) {
        this.logger.warn(`upsertGlossary failed (${mangaId}/${targetLang}): ${error.message}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`upsertGlossary threw (${mangaId}/${targetLang}): ${String(e)}`);
      return false;
    }
  }
}
