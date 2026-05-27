import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';

const DEFAULT_TTL_MS = 1000 * 60 * 20; // 20 minutes

@Injectable()
export class CacheOrchestratorService implements OnApplicationShutdown {
  private readonly logger = new Logger(CacheOrchestratorService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly jsonCache: JsonCacheService,
    private readonly batchSync: BatchSyncWorker,
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
    }

    this.logger.log(
      `Cache SET [manga] key=${key} json=permanent redis=${Math.floor(redisTtlMs / 1000)}s`,
    );
  }

  /**
   * Graceful Shutdown: compare Redis ↔ JSON timestamp, sync newer to older.
   */
  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Graceful shutdown triggered (signal=${signal ?? 'none'}) — syncing caches…`);

    const allJsonEntries = this.jsonCache.getAll();

    for (const [key, jsonEntry] of allJsonEntries.entries()) {
      if (!this.redis.available) break;

      try {
        const raw = await this.redis.get(key);
        if (!raw) {
          // Redis missing this key — write JSON data to Redis
          const ttlRemaining = Math.floor(
            (jsonEntry.ttlMs - (Date.now() - new Date(jsonEntry.updatedAt).getTime())) / 1000,
          );
          if (ttlRemaining > 0) {
            await this.setWithRetry(key, JSON.stringify(jsonEntry), ttlRemaining);
            this.logger.log(`Shutdown sync: wrote JSON→Redis for key=${key}`);
          }
          continue;
        }

        const redisEntry = JSON.parse(raw) as CacheEntry<unknown>;
        const redisTime = new Date(redisEntry.updatedAt).getTime();
        const jsonTime = new Date(jsonEntry.updatedAt).getTime();

        if (redisTime > jsonTime) {
          // Redis is newer → update JSON
          this.jsonCache.syncEntry(key, redisEntry);
          this.logger.log(`Shutdown sync: Redis→JSON (redis newer) key=${key}`);
        } else if (jsonTime > redisTime) {
          // JSON is newer → update Redis
          const ttlSec = Math.floor(
            (jsonEntry.ttlMs - (Date.now() - jsonTime)) / 1000,
          );
          if (ttlSec > 0) {
            await this.setWithRetry(key, JSON.stringify(jsonEntry), ttlSec);
            this.logger.log(`Shutdown sync: JSON→Redis (json newer) key=${key}`);
          }
        } else {
          this.logger.debug(`Shutdown sync: in-sync key=${key}`);
        }
      } catch (err) {
        this.logger.warn(`Shutdown sync error for key=${key}: ${String(err)}`);
      }
    }

    this.logger.log('Cache sync complete — ready to exit');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async setWithRetry(
    key: string,
    value: string,
    ttlSec: number,
  ): Promise<void> {
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.redis.set(key, value, ttlSec);
        return;
      } catch (err) {
        if (i === maxRetries - 1) {
          this.logger.error(
            `CRITICAL: Failed to sync key=${key} to Redis after ${maxRetries} attempts: ${String(err)}`,
          );
          return; // Don't throw to allow other keys to sync
        }
        const delay = Math.pow(2, i) * 500; // Exponential backoff
        this.logger.warn(
          `Shutdown sync retry ${i + 1}/${maxRetries} for key=${key} in ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }
  }
}
