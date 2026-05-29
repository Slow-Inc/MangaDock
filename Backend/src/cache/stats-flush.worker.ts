import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ElectionService } from '../status/election.service';
import { SupabaseService } from '../supabase/supabase.service';

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class StatsFlushWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StatsFlushWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly election: ElectionService,
    private readonly supabase: SupabaseService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(
      () => this.flush().catch(err => this.logger.warn(`Stats flush error: ${String(err)}`)),
      FLUSH_INTERVAL_MS,
    ).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async flush(date = new Date().toISOString().slice(0, 10)): Promise<void> {
    if (!this.election.isLeader) return;
    await this.flushDate(date);
    // Drain yesterday's trailing window — views between the last pre-midnight tick and 23:59:59 UTC
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    if (yesterday !== date) await this.flushDate(yesterday);
  }

  private async flushDate(date: string): Promise<void> {
    const chapterIds = await this.redis.smembers(`stats:active:${date}`);
    if (chapterIds.length === 0) return;

    this.logger.log(`StatsFlush: flushing ${chapterIds.length} active chapter(s) for ${date}`);

    for (const chapterId of chapterIds) {
      await this.flushChapter(chapterId, date);
    }
  }

  private async flushChapter(chapterId: string, date: string): Promise<void> {
    try {
      const [rawViews, uniqueReaders] = await Promise.all([
        this.redis.get(`stats:chapter:${chapterId}:views:${date}`),
        this.redis.pfcount(`stats:chapter:${chapterId}:hll:${date}`),
      ]);

      const views = rawViews ? parseInt(rawViews, 10) : 0;

      const mangaId = await this.resolveMangaId(chapterId, date);

      const { error } = await this.supabase.client
        .from('chapter_daily_stats')
        .upsert({ chapter_id: chapterId, manga_id: mangaId, date, views, unique_readers: uniqueReaders },
          { onConflict: 'chapter_id,date' });

      if (error) {
        this.logger.warn(`StatsFlush: upsert failed chapter=${chapterId} date=${date}: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(`StatsFlush: error for chapter=${chapterId}: ${String(err)}`);
    }
  }

  private async resolveMangaId(chapterId: string, date: string): Promise<string> {
    const raw = await this.redis.get(`stats:chapter:${chapterId}:manga:${date}`);
    return raw ?? '';
  }
}
