import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ElectionService } from '../status/election.service';
import { RedisService } from './redis.service';
import { L3DiskService } from './l3-disk.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { CacheEntry } from './json-cache.service';

export const DIRTY_QUEUE = 'cache:dirty';
export const PROCESSING_QUEUE = 'cache:processing';
const CACHE_SYNC_RPC = 'upsert_cache_entry';
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 100;

// Atomic crash recovery: read orphans, clear processing queue, re-enqueue to dirty — all in one round-trip.
// Guards against the DEL→RPUSH window where a crash would silently drop keys mid-recovery.
const RECOVER_SCRIPT = `
  local orphans = redis.call('LRANGE', KEYS[1], 0, -1)
  if #orphans == 0 then return 0 end
  redis.call('DEL', KEYS[1])
  for _, key in ipairs(orphans) do
    redis.call('RPUSH', KEYS[2], key)
  end
  return #orphans
`;

@Injectable()
export class BatchSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BatchSyncWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private lastFlushWasLeader = false;

  constructor(
    private readonly redis: RedisService,
    private readonly election: ElectionService,
    private readonly l3: L3DiskService,
    private readonly supabase: SupabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.timer = setInterval(
      () => this.flush().catch(err => this.logger.warn(`Flush error: ${String(err)}`)),
      FLUSH_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async markDirty(key: string): Promise<void> {
    const client = await this.redis.getClient();
    if (!client) return;
    try {
      await (client as any).rpush(DIRTY_QUEUE, key);
    } catch (err) {
      this.logger.warn(`markDirty failed key=${key}: ${String(err)}`);
    }
  }

  private async recoverOrphans(): Promise<void> {
    const client = await this.redis.getClient();
    if (!client) return;
    try {
      const count = await (client as any).eval(RECOVER_SCRIPT, 2, PROCESSING_QUEUE, DIRTY_QUEUE) as number;
      if (count > 0) {
        this.logger.warn(`Crash recovery: atomically re-queued ${count} orphaned key(s) → ${DIRTY_QUEUE}`);
      }
    } catch (err) {
      this.logger.warn(`Crash recovery failed: ${String(err)}`);
    }
  }

  private async flush(): Promise<void> {
    if (!this.election.isLeader) {
      this.lastFlushWasLeader = false;
      return;
    }
    const client = await this.redis.getClient();
    if (!client) return;

    const justBecameLeader = !this.lastFlushWasLeader;
    this.lastFlushWasLeader = true;
    if (justBecameLeader) {
      await this.recoverOrphans();
    }

    const seen = new Set<string>();
    for (let i = 0; i < MAX_BATCH_SIZE; i++) {
      const key: string | null = await (client as any).rpoplpush(DIRTY_QUEUE, PROCESSING_QUEUE);
      if (!key) break;
      if (seen.has(key)) {
        // Duplicate in queue — remove extra processing entry immediately to avoid orphan on crash
        await client.lrem(PROCESSING_QUEUE, 1, key);
        continue;
      }
      seen.add(key);
    }
    const processed = [...seen];
    if (processed.length === 0) return;

    this.logger.log(`BatchSync: flushing ${processed.length} dirty key(s)`);

    for (const key of processed) {
      await this.syncKey(key, client);
    }
  }

  private async syncKey(key: string, client: any): Promise<void> {
    const raw = await this.redis.get(key);
    if (!raw) {
      await client.lrem(PROCESSING_QUEUE, 1, key); // expired — ack to prevent permanent orphan
      return;
    }

    let entry: CacheEntry<unknown>;
    try {
      entry = JSON.parse(raw) as CacheEntry<unknown>;
    } catch {
      this.logger.warn(`BatchSync: corrupt Redis entry key=${key} — acking to prevent orphan`);
      await client.lrem(PROCESSING_QUEUE, 1, key);
      return;
    }

    this.l3.write(key, entry);

    try {
      const { error } = await this.supabase.client.rpc(CACHE_SYNC_RPC, { p_key: key, p_entry: entry }) as { error: Error | null };
      if (error) throw error;
      await client.lrem(PROCESSING_QUEUE, 1, key);
    } catch (err) {
      this.logger.warn(`BatchSync: Supabase RPC failed key=${key}: ${String(err)} — left in processing for retry`);
      // Do NOT lrem — key stays in processing queue for next recovery cycle
    }
  }
}
