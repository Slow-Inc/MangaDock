import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';
import { L3DiskService } from './l3-disk.service';
import { ElectionService } from '../status/election.service';

const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

@Injectable()
export class L2RecoveryService implements OnModuleInit {
  private readonly logger = new Logger(L2RecoveryService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly jsonCache: JsonCacheService,
    private readonly batchSync: BatchSyncWorker,
    private readonly l3: L3DiskService,
    private readonly election: ElectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.redis.onReconnect(() => {
      if (!this.election.isLeader) return;
      this.recover().catch(err => this.logger.warn(`L2 recovery failed: ${String(err)}`));
    });
    if (this.redis.available && this.election.isLeader) {
      await this.recover();
    }
  }

  async recover(): Promise<{ synced: number; skipped: number }> {
    const l1 = this.jsonCache.getAll();
    const l3 = this.l3.readAll();

    const allKeys = new Set([...l1.keys(), ...l3.keys()]);
    let synced = 0;
    let skipped = 0;

    for (const key of allKeys) {
      const entry = this.newerEntry(l1.get(key), l3.get(key));
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

  private newerEntry(l1?: CacheEntry<unknown>, l3?: CacheEntry<unknown>): CacheEntry<unknown> {
    if (!l1) return l3!;
    if (!l3) return l1;
    return new Date(l1.updatedAt) >= new Date(l3.updatedAt) ? l1 : l3;
  }
}
