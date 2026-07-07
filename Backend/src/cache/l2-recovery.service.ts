import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';
import { L3DiskService } from './l3-disk.service';
import { ElectionService } from '../status/election.service';
import { DIRTY_QUEUE } from './batch-sync.worker';

const SEVEN_DAYS_S = 7 * 24 * 60 * 60;
const PIPELINE_CHUNK_SIZE = 500;

@Injectable()
export class L2RecoveryService implements OnModuleInit {
  private readonly logger = new Logger(L2RecoveryService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly jsonCache: JsonCacheService,
    private readonly l3: L3DiskService,
    private readonly election: ElectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Fires recover() the moment this node wins the election — works on cold boot and failover.
    this.election.onBecomeLeader(() => {
      this.recover().catch(err => this.logger.warn(`L2 recovery failed: ${String(err)}`));
    });
    // Fires recover() when Redis reconnects and we're already the leader (short outage where TTL didn't expire).
    this.redis.onReconnect(() => {
      if (!this.election.isLeader) return;
      this.recover().catch(err => this.logger.warn(`L2 recovery failed: ${String(err)}`));
    });
  }

  async recover(): Promise<{ synced: number; skipped: number }> {
    const l3 = this.l3.readAll();
    const fallbackKeys = this.l3.drainDirtyFallback();
    // Snapshot L1 keys synchronously (no full-map clone) before any await. (FR-5)
    const allKeys = new Set([...this.jsonCache.keys(), ...l3.keys()]);

    if (allKeys.size === 0 && fallbackKeys.length === 0) return { synced: 0, skipped: 0 };

    const client = await this.redis.getClient();
    if (!client) return { synced: 0, skipped: 0 };

    let skipped = 0;

    type Pending = { key: string; value: string; ttlSeconds: number };
    const toSync: Pending[] = [];

    for (const key of allKeys) {
      const l1Entry = this.jsonCache.peek(key) ?? undefined;
      const l3Entry = l3.get(key);
      // The key was in the snapshot but has since been evicted from L1 (live read
      // after the await) and isn't on L3 either — nothing to sync, skip. (FR-5)
      if (!l1Entry && !l3Entry) {
        skipped++;
        continue;
      }
      const entry = this.newerEntry(l1Entry, l3Entry);
      if (this.jsonCache.isExpired(entry)) {
        skipped++;
        continue;
      }
      const ttlSeconds = entry.ttlMs <= 0
        ? SEVEN_DAYS_S
        : Math.max(Math.floor((entry.ttlMs - (Date.now() - new Date(entry.updatedAt).getTime())) / 1000), 1);
      toSync.push({ key, value: JSON.stringify(entry), ttlSeconds });
    }

    // Include fallback-only keys (modified while Redis was down, possibly evicted from L1)
    const knownKeys = new Set(toSync.map(p => p.key));
    for (const key of fallbackKeys) {
      if (!knownKeys.has(key)) {
        toSync.push({ key, value: '', ttlSeconds: 0 }); // value/ttl unused — only rpush matters
      }
    }

    if (toSync.length === 0 && skipped === 0) return { synced: 0, skipped: 0 };

    let synced = 0;

    for (let i = 0; i < toSync.length; i += PIPELINE_CHUNK_SIZE) {
      const chunk = toSync.slice(i, i + PIPELINE_CHUNK_SIZE);
      const pipeline = client.pipeline();
      for (const { key, value, ttlSeconds } of chunk) {
        if (value) pipeline.set(key, value, 'EX', ttlSeconds);
        pipeline.rpush(DIRTY_QUEUE, key);
      }
      try {
        await pipeline.exec();
        synced += chunk.length;
      } catch (err) {
        this.logger.warn(`L2 recovery: chunk [${i}–${i + chunk.length - 1}] failed: ${String(err)}`);
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
