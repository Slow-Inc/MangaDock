import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ElectionService } from '../status/election.service';
import { RedisService } from './redis.service';
import { L3DiskService } from './l3-disk.service';
import type { CacheEntry } from './json-cache.service';

export const DIRTY_QUEUE = 'cache:dirty';
export const PROCESSING_QUEUE = 'cache:processing';
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 100;

@Injectable()
export class BatchSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BatchSyncWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly election: ElectionService,
    private readonly l3: L3DiskService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.recoverOrphans();
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
      const orphans: string[] = await (client as any).lrange(PROCESSING_QUEUE, 0, -1);
      if (orphans.length === 0) return;
      await (client as any).del(PROCESSING_QUEUE);
      for (const key of orphans) {
        await (client as any).rpush(DIRTY_QUEUE, key);
        this.logger.warn(`Crash recovery: re-queued orphaned key=${key}`);
      }
    } catch (err) {
      this.logger.warn(`Crash recovery failed: ${String(err)}`);
    }
  }

  private async flush(): Promise<void> {
    if (!this.election.isLeader) return;
    const client = await this.redis.getClient();
    if (!client) return;

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
    try {
      const entry = JSON.parse(raw) as CacheEntry<unknown>;
      this.l3.write(key, entry); // Leader re-sync L2 → L3; disk errors swallowed internally
      await client.lrem(PROCESSING_QUEUE, 1, key);
    } catch (err) {
      this.logger.warn(`BatchSync: failed to sync key=${key}: ${String(err)}`);
    }
  }
}
