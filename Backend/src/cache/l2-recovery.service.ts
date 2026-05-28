import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JsonCacheService } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';

const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

@Injectable()
export class L2RecoveryService implements OnModuleInit {
  private readonly logger = new Logger(L2RecoveryService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly jsonCache: JsonCacheService,
    private readonly batchSync: BatchSyncWorker,
  ) {}

  async onModuleInit(): Promise<void> {
    this.redis.onReconnect(() => {
      this.recover().catch(err => this.logger.warn(`L2 recovery failed: ${String(err)}`));
    });
    if (this.redis.available) {
      await this.recover();
    }
  }

  async recover(): Promise<{ synced: number; skipped: number }> {
    const all = this.jsonCache.getAll();
    let synced = 0;
    let skipped = 0;

    for (const [key, entry] of all) {
      const expired = this.jsonCache.isExpired(entry);
      if (expired) {
        skipped++;
        continue;
      }

      const ttl = entry.ttlMs <= 0
        ? SEVEN_DAYS_S
        : Math.max(Math.floor((entry.ttlMs - (Date.now() - new Date(entry.updatedAt).getTime())) / 1000), 1);

      try {
        await this.redis.set(key, JSON.stringify(entry), ttl);
        await this.batchSync.markDirty(key);
        synced++;
      } catch (err) {
        this.logger.warn(`L2 recovery: failed key=${key}: ${String(err)}`);
      }
    }

    if (synced > 0 || skipped > 0) {
      this.logger.log(`L2 recovery: synced=${synced} skipped=${skipped}`);
    }

    return { synced, skipped };
  }
}
