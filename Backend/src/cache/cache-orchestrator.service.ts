import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';
import { L3BatchWriter } from './l3-batch-writer';

const DEFAULT_TTL_MS = 1000 * 60 * 20; // 20 minutes

@Injectable()
export class CacheOrchestratorService implements OnApplicationShutdown {
  private readonly logger = new Logger(CacheOrchestratorService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly jsonCache: JsonCacheService,
    private readonly batchSync: BatchSyncWorker,
    private readonly l3BatchWriter: L3BatchWriter,
  ) {}

  /**
   * Get data from cache (Redis → JSON → API fallback).
   * Returns null if not found in any cache.
   */
  async get<T>(key: string): Promise<{ data: T; source: 'redis' | 'json' } | null> {
    // 1. Try Redis first
    if (this.redis.available) {
      const raw = await this.redis.get(key);
      if (raw) {
        try {
          const entry = JSON.parse(raw) as CacheEntry<T>;
          this.logger.debug(`Cache HIT [redis] key=${key}`);
          return { data: entry.data, source: 'redis' };
        } catch {
          this.logger.warn(`Redis entry corrupt for key=${key}, will re-fetch`);
        }
      }
    }

    // 2. Try JSON cache
    const jsonEntry = this.jsonCache.get<T>(key);
    if (jsonEntry) {
      const expired = this.jsonCache.isExpired(jsonEntry);
      if (!expired) {
        this.logger.debug(`Cache HIT [json] key=${key}`);
        // Warm Redis back up
        if (this.redis.available) {
          const ttlRemaining = Math.floor(
            (jsonEntry.ttlMs - (Date.now() - new Date(jsonEntry.updatedAt).getTime())) / 1000,
          );
          if (ttlRemaining > 0) {
            await this.redis.set(key, JSON.stringify(jsonEntry), ttlRemaining);
          }
        }
        return { data: jsonEntry.data, source: 'json' };
      }
      this.logger.debug(`Cache EXPIRED [json] key=${key}, will re-fetch`);
    }

    return null;
  }

  /**
   * Write-behind: write to Redis (L2) immediately, sync L1 and persist asynchronously via BatchSyncWorker.
   */
  async set<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      updatedAt: new Date().toISOString(),
      ttlMs,
    };

    // L1: write directly for in-process read consistency
    this.jsonCache.set(key, data, ttlMs);

    // L2: write to Redis (source of truth at runtime)
    if (this.redis.available) {
      await this.redis.set(key, JSON.stringify(entry), Math.floor(ttlMs / 1000));
      // Enqueue for leader-only batch persistence
      await this.batchSync.markDirty(key);
    }

    this.logger.log(`Cache SET key=${key} ttl=${Math.floor(ttlMs / 1000)}s redis=${this.redis.available}`);
  }

  /**
   * Get stale data from JSON cache regardless of TTL expiry.
   * Used as a fallback when the upstream API is unavailable.
   * Returns null only if there is truly no cached data at all.
   */
  getStale<T>(key: string): { data: T; updatedAt: string } | null {
    const entry = this.jsonCache.get<T>(key);
    if (!entry) return null;
    this.logger.debug(`Stale cache HIT [json] key=${key} updatedAt=${entry.updatedAt}`);
    return { data: entry.data, updatedAt: entry.updatedAt };
  }

  /**
   * Save manga translation data: permanent in JSON, temporary in Redis.
   * Keeps Redis lean while JSON holds the persistent source of truth.
   */
  async setMangaCacheWithTiers<T>(
    key: string,
    data: T,
    redisTtlMs: number = 1000 * 60 * 60 * 24, // 1 day default
  ): Promise<void> {
    const jsonEntry: CacheEntry<T> = {
      data,
      updatedAt: new Date().toISOString(),
      ttlMs: -1, // permanent in L1
    };
    this.jsonCache.set(key, data, -1);

    if (this.redis.available) {
      await this.redis.set(key, JSON.stringify(jsonEntry), Math.floor(redisTtlMs / 1000));
      await this.batchSync.markDirty(key);
    }

    this.logger.log(
      `Cache SET [manga] key=${key} json=permanent redis=${Math.floor(redisTtlMs / 1000)}s`,
    );
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Graceful shutdown (signal=${signal ?? 'none'}) — final L3 flush…`);
    await this.l3BatchWriter.flush();
    this.logger.log('L3 flush complete — ready to exit');
  }
}
