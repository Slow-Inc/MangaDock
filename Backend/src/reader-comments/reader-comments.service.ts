import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { isInvalidId } from '../common/assert-found';

export type ReaderComment = {
  id: string;
  uid: string;
  mangaId: string;
  chapterId: string;
  pageNumber: number;
  body: string;
  createdAt: string;
  displayName: string | null;
  photoUrl: string | null;
};

type CommentRow = {
  id: string;
  uid: string;
  manga_id: string;
  chapter_id: string;
  page_number: number;
  body: string;
  created_at: string;
  profiles:
    | { display_name: string | null; photo_url: string | null }
    | { display_name: string | null; photo_url: string | null }[]
    | null;
};

@Injectable()
export class ReaderCommentsService {
  private readonly logger = new Logger(ReaderCommentsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  private map(row: CommentRow): ReaderComment {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    return {
      id: row.id,
      uid: row.uid,
      mangaId: row.manga_id,
      chapterId: row.chapter_id,
      pageNumber: row.page_number,
      body: row.body,
      createdAt: row.created_at,
      displayName: profile?.display_name ?? null,
      photoUrl: profile?.photo_url ?? null,
    };
  }

  async getComments(
    mangaId: string,
    chapterId: string,
    pageNumber: number,
    limit = 50,
  ): Promise<ReaderComment[]> {
    const { data, error } = await this.db
      .from('reader_comments')
      .select(
        'id, uid, manga_id, chapter_id, page_number, body, created_at, profiles(display_name, photo_url)',
      )
      .eq('manga_id', mangaId)
      .eq('chapter_id', chapterId)
      .eq('page_number', pageNumber)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch comments: ${error.message}`);
    return (data ?? []).map((r) => this.map(r));
  }

  async addComment(
    uid: string,
    mangaId: string,
    chapterId: string,
    pageNumber: number,
    body: string,
  ): Promise<ReaderComment> {
    if (!body?.trim()) throw new BadRequestException('body is required');

    const { data, error } = await this.db
      .from('reader_comments')
      .insert({
        uid,
        manga_id: mangaId,
        chapter_id: chapterId,
        page_number: pageNumber,
        body: body.trim(),
      })
      .select(
        'id, uid, manga_id, chapter_id, page_number, body, created_at, profiles(display_name, photo_url)',
      )
      .single();

    if (error) throw new Error(`Failed to add comment: ${error.message}`);
    this.logger.log(
      `User ${uid} commented on ${mangaId}/${chapterId} p${pageNumber}`,
    );
    return this.map(data);
  }

  async deleteComment(uid: string, id: string): Promise<void> {
    const { error } = await this.db
      .from('reader_comments')
      .delete()
      .eq('id', id)
      .eq('uid', uid);

    if (isInvalidId(error)) throw new BadRequestException('Invalid comment id'); // not a 500 (#1015)
    if (error) throw new Error(`Failed to delete comment: ${error.message}`);
  }
}
