import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';
import { L3DiskService } from './l3-disk.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { CacheEntry } from './json-cache.service';
import { DIRTY_QUEUE } from './batch-sync.worker';

const PIPELINE_CHUNK_SIZE = 500;
const SUPABASE_BATCH_SIZE = 100;
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;
const MAX_JITTER_MS = 5_000;

type CacheRow = { key: string; data: unknown; updated_at: string; ttl_ms: number };
type WinnerEntry = { entry: CacheEntry<unknown>; source: 'l3' | 'supabase' };

@Injectable()
export class CatastrophicRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(CatastrophicRecoveryService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly l3: L3DiskService,
    private readonly supabase: SupabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.redis.available) return; // L2RecoveryService handles this path

    const l3Entries = this.l3.readAll();
    if (l3Entries.size === 0) {
      this.logger.log('CatastrophicRecovery: L3 empty — nothing to buffer');
      return;
    }

    this.logger.log(
      `CatastrophicRecovery: Redis down at boot — comparing ${l3Entries.size} L3 key(s) against Supabase`,
    );
    const winners = await this.buildWinnerBuffer(l3Entries);
    this.logger.log(`CatastrophicRecovery: buffered ${winners.size} winner key(s) for L2 push on reconnect`);

    const unregister = this.redis.onReconnect(() =>
      this.pushToL2(winners)
        .then(() => unregister())
        .catch(err =>
          this.logger.warn(`CatastrophicRecovery: reconnect push failed: ${String(err)}`),
        ),
    );
  }

  private async buildWinnerBuffer(
    l3Entries: Map<string, CacheEntry<unknown>>,
  ): Promise<Map<string, WinnerEntry>> {
    const winners = new Map<string, WinnerEntry>(
      [...l3Entries.entries()].map(([key, entry]) => [key, { entry, source: 'l3' }]),
    );
    const keys = [...l3Entries.keys()];

    try {
      for (let i = 0; i < keys.length; i += SUPABASE_BATCH_SIZE) {
        const batch = keys.slice(i, i + SUPABASE_BATCH_SIZE);
        const { data, error } = await this.supabase.client
          .from('cache_entries')
          .select('key, data, updated_at, ttl_ms')
          .in('key', batch) as { data: CacheRow[] | null; error: any };

        if (error) throw error;

        for (const row of data ?? []) {
          const l3Entry = l3Entries.get(row.key);
          if (l3Entry && new Date(row.updated_at) > new Date(l3Entry.updatedAt)) {
            winners.set(row.key, {
              entry: { data: row.data, updatedAt: row.updated_at, ttlMs: row.ttl_ms },
              source: 'supabase',
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `CatastrophicRecovery: Supabase unavailable — falling back to L3-only: ${String(err)}`,
      );
    }

    return winners;
  }

  private async pushToL2(entries: Map<string, WinnerEntry>): Promise<void> {
    // Jitter: prevents thundering herd when all nodes reconnect simultaneously
    await new Promise<void>(resolve => setTimeout(resolve, Math.random() * MAX_JITTER_MS));

    const client = await this.redis.getClient();
    if (!client) {
      this.logger.warn('CatastrophicRecovery: reconnect fired but Redis client unavailable — skipping');
      return;
    }

    const toSync = [...entries.entries()].map(([key, { entry, source }]) => {
      const ttlSeconds =
        entry.ttlMs <= 0
          ? SEVEN_DAYS_S
          : Math.max(
              Math.floor((entry.ttlMs - (Date.now() - new Date(entry.updatedAt).getTime())) / 1000),
              1,
            );
      return { key, value: JSON.stringify(entry), ttlSeconds, source };
    });

    let pushed = 0;
    for (let i = 0; i < toSync.length; i += PIPELINE_CHUNK_SIZE) {
      const chunk = toSync.slice(i, i + PIPELINE_CHUNK_SIZE);
      const pipeline = (client as any).pipeline();
      for (const { key, value, ttlSeconds, source } of chunk) {
        pipeline.set(key, value, 'EX', ttlSeconds);
        if (source === 'l3') pipeline.rpush(DIRTY_QUEUE, key); // Supabase winner: already in DB, skip re-sync
      }
      try {
        await pipeline.exec();
        pushed += chunk.length;
      } catch (err) {
        this.logger.warn(
          `CatastrophicRecovery: chunk [${i}–${i + chunk.length - 1}] failed: ${String(err)}`,
        );
      }
    }

    this.logger.log(`CatastrophicRecovery: pushed ${pushed} key(s) to L2`);
  }
}
