import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type FeedbackSummary = {
  pageNumber: number;
  up: number;
  down: number;
};

export type MyVote = { pageNumber: number; vote: 1 | -1 } | null;

@Injectable()
export class TranslationFeedbackService {
  private readonly logger = new Logger(TranslationFeedbackService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  async submitVote(
    uid: string,
    mangaId: string,
    chapterId: string,
    pageNumber: number,
    vote: 1 | -1,
  ): Promise<void> {
    const { error } = await this.db.from('translation_feedback').upsert(
      { uid, manga_id: mangaId, chapter_id: chapterId, page_number: pageNumber, vote },
      { onConflict: 'uid,manga_id,chapter_id,page_number' },
    );
    if (error) throw new Error(`Failed to submit vote: ${error.message}`);
    this.logger.log(`User ${uid} voted ${vote > 0 ? 'up' : 'down'} on ${mangaId}/${chapterId} p${pageNumber}`);
  }

  async deleteVote(uid: string, mangaId: string, chapterId: string, pageNumber: number): Promise<void> {
    const { error } = await this.db
      .from('translation_feedback')
      .delete()
      .eq('uid', uid)
      .eq('manga_id', mangaId)
      .eq('chapter_id', chapterId)
      .eq('page_number', pageNumber);
    if (error) throw new Error(`Failed to delete vote: ${error.message}`);
  }

  async getChapterSummary(mangaId: string, chapterId: string): Promise<FeedbackSummary[]> {
    const { data, error } = await this.db
      .from('translation_feedback')
      .select('page_number, vote')
      .eq('manga_id', mangaId)
      .eq('chapter_id', chapterId);

    if (error) throw new Error(`Failed to fetch summary: ${error.message}`);

    const map = new Map<number, { up: number; down: number }>();
    for (const row of data ?? []) {
      const r = row as { page_number: number; vote: number };
      const entry = map.get(r.page_number) ?? { up: 0, down: 0 };
      if (r.vote > 0) entry.up++; else entry.down++;
      map.set(r.page_number, entry);
    }

    return Array.from(map.entries()).map(([pageNumber, counts]) => ({
      pageNumber,
      ...counts,
    }));
  }

  async getMyVote(uid: string, mangaId: string, chapterId: string, pageNumber: number): Promise<MyVote> {
    const { data, error } = await this.db
      .from('translation_feedback')
      .select('page_number, vote')
      .eq('uid', uid)
      .eq('manga_id', mangaId)
      .eq('chapter_id', chapterId)
      .eq('page_number', pageNumber)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch vote: ${error.message}`);
    if (!data) return null;
    const row = data as { page_number: number; vote: number };
    return { pageNumber: row.page_number, vote: row.vote as 1 | -1 };
  }
}
