import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

const SECONDS_IN_DAY = 86_400;

@Injectable()
export class StatsIncrementService {
  private readonly logger = new Logger(StatsIncrementService.name);

  constructor(private readonly redis: RedisService) {}

  async recordChapterView(chapterId: string, mangaId: string, uid: string, date: string): Promise<void> {
    if (!this.redis.available) return;

    const viewsKey = `stats:chapter:${chapterId}:views:${date}`;
    const hllKey = `stats:chapter:${chapterId}:hll:${date}`;
    const activeKey = `stats:active:${date}`;
    const mangaKey = `stats:chapter:${chapterId}:manga:${date}`;
    const ttl = this.secondsUntilEndOfDay(date);

    try {
      // INCR/PFADD/SADD don't accept TTL — expire is best-effort in a second round-trip.
      // If the process dies between these two awaits, keys persist until Redis restart.
      await Promise.all([
        this.redis.incr(viewsKey),
        this.redis.pfadd(hllKey, uid),
        this.redis.sadd(activeKey, chapterId),
        this.redis.set(mangaKey, mangaId, ttl),
      ]);

      await Promise.all([
        this.redis.expire(viewsKey, ttl),
        this.redis.expire(hllKey, ttl),
        this.redis.expire(activeKey, ttl),
      ]);
    } catch (err) {
      this.logger.warn(`recordChapterView failed chapter=${chapterId}: ${String(err)}`);
    }
  }

  private secondsUntilEndOfDay(date: string): number {
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    const remaining = Math.floor((endOfDay.getTime() - Date.now()) / 1000);
    return Math.max(remaining, SECONDS_IN_DAY);
  }
}
