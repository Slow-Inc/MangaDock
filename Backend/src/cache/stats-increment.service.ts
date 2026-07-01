import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Floor for the daily-stat TTL: never expire a key in under a minute, so a
 *  view recorded moments before midnight still survives long enough to be read
 *  back. (Not a full day — that would keep the key alive past its own day.) */
const MIN_TTL_SECONDS = 60;

/** Grace period added on top of "seconds until midnight" so the StatsFlushWorker
 *  (5-min unaligned interval, worst-case just under 5 min of lag) still finds
 *  yesterday's trailing-window keys when it drains them just after midnight.
 *  15 min covers that lag with margin — nowhere near the old full-day TTL bug. */
const GRACE_SECONDS = 900;

/** All four stat writes + their TTLs in one atomic round-trip (#139) — the old
 *  two-phase write left immortal keys when the process died between the write
 *  and the EXPIRE batch. Same named-constant Lua pattern as ElectionService.
 *  KEYS: views, hll, active, manga · ARGV: uid, chapterId, mangaId, ttlSec */
const RECORD_VIEW_SCRIPT = `
redis.call('INCR', KEYS[1])
redis.call('PFADD', KEYS[2], ARGV[1])
redis.call('SADD', KEYS[3], ARGV[2])
redis.call('SET', KEYS[4], ARGV[3], 'EX', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[4])
redis.call('EXPIRE', KEYS[3], ARGV[4])
return 1
`;

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
      const client = await this.redis.getClient();
      await (client as any).eval(
        RECORD_VIEW_SCRIPT,
        4,
        viewsKey,
        hllKey,
        activeKey,
        mangaKey,
        uid,
        chapterId,
        mangaId,
        String(ttl),
      );
    } catch (err) {
      this.logger.warn(`recordChapterView failed chapter=${chapterId}: ${String(err)}`);
    }
  }

  private secondsUntilEndOfDay(date: string): number {
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    const remaining = Math.floor((endOfDay.getTime() - Date.now()) / 1000);
    return Math.max(remaining, MIN_TTL_SECONDS) + GRACE_SECONDS;
  }
}
