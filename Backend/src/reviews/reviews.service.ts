import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type ReviewItem = {
  id: string;
  uid: string;
  mangaId: string;
  rating: number;
  body: string;
  createdAt: string;
  displayName: string | null;
  photoUrl: string | null;
};

export type ReviewSummary = {
  averageRating: number;
  count: number;
};

type ReviewRow = {
  id: string;
  uid: string;
  manga_id: string;
  rating: number;
  body: string;
  created_at: string;
  profiles: { display_name: string | null; photo_url: string | null } | null;
};

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  private mapReview(row: ReviewRow): ReviewItem {
    return {
      id: row.id,
      uid: row.uid,
      mangaId: row.manga_id,
      rating: row.rating,
      body: row.body ?? '',
      createdAt: row.created_at,
      displayName: row.profiles?.display_name ?? null,
      photoUrl: row.profiles?.photo_url ?? null,
    };
  }

  async upsertReview(
    uid: string,
    mangaId: string,
    data: { mangaTitle: string; rating: number; body: string },
  ): Promise<void> {
    if (!mangaId) throw new BadRequestException('mangaId is required');
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    const now = new Date().toISOString();
    const { error } = await this.db.from('manga_reviews').upsert(
      {
        uid,
        manga_id: mangaId,
        manga_title: data.mangaTitle ?? '',
        rating: data.rating,
        body: data.body?.trim() ?? '',
        updated_at: now,
      },
      { onConflict: 'uid,manga_id' },
    );

    if (error) throw new Error(`Failed to upsert review: ${error.message}`);
    this.logger.log(`User ${uid} reviewed manga ${mangaId} with rating ${data.rating}`);
  }

  async deleteReview(uid: string, mangaId: string): Promise<void> {
    const { error } = await this.db
      .from('manga_reviews')
      .delete()
      .eq('uid', uid)
      .eq('manga_id', mangaId);

    if (error) throw new Error(`Failed to delete review: ${error.message}`);
    this.logger.log(`User ${uid} deleted review for manga ${mangaId}`);
  }

  async getMyReview(uid: string, mangaId: string): Promise<ReviewItem | null> {
    const { data, error } = await this.db
      .from('manga_reviews')
      .select('id, uid, manga_id, rating, body, created_at, profiles(display_name, photo_url)')
      .eq('uid', uid)
      .eq('manga_id', mangaId)
      .maybeSingle<ReviewRow>();

    if (error) throw new Error(`Failed to fetch review: ${error.message}`);
    return data ? this.mapReview(data) : null;
  }

  async getReviews(
    mangaId: string,
    limit = 20,
    offset = 0,
  ): Promise<ReviewItem[]> {
    const { data, error } = await this.db
      .from('manga_reviews')
      .select('id, uid, manga_id, rating, body, created_at, profiles(display_name, photo_url)')
      .eq('manga_id', mangaId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);
    return (data ?? []).map((row) => this.mapReview(row as ReviewRow));
  }

  async getReviewSummary(mangaId: string): Promise<ReviewSummary> {
    const { data, error } = await this.db
      .from('manga_reviews')
      .select('rating')
      .eq('manga_id', mangaId);

    if (error) throw new Error(`Failed to fetch review summary: ${error.message}`);

    const rows = data ?? [];
    if (rows.length === 0) return { averageRating: 0, count: 0 };

    const sum = rows.reduce((acc, r) => acc + (r as { rating: number }).rating, 0);
    return {
      averageRating: Math.round((sum / rows.length) * 10) / 10,
      count: rows.length,
    };
  }
}
