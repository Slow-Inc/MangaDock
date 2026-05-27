import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JsonCacheService, CacheEntry } from './json-cache.service';
import { L3DiskService } from './l3-disk.service';

export const FLUSH_CONFIG: Array<{ prefix: string; intervalMs: number }> = [
  { prefix: 'wallet:', intervalMs: 2_000 },
  { prefix: 'stats:', intervalMs: 5_000 },
  { prefix: '', intervalMs: 60_000 }, // '' = all remaining keys not matched above
];

const SPECIFIC_PREFIXES = FLUSH_CONFIG.filter((c) => c.prefix !== '').map((c) => c.prefix);

@Injectable()
export class L3BatchWriter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(L3BatchWriter.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly redis: RedisService,
    private readonly jsonCache: JsonCacheService,
    private readonly l3: L3DiskService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.flush(); // warm L3 with all L1 keys immediately on startup
    for (const { prefix, intervalMs } of FLUSH_CONFIG) {
      const timer = setInterval(() => void this.flush(prefix), intervalMs);
      this.timers.push(timer);
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }

  async flush(prefix?: string): Promise<void> {
    if (!this.redis.available) return;

    const all = [...this.jsonCache.getAll().keys()];
    const keys =
      prefix === undefined
        ? all
        : prefix === ''
          ? all.filter((k) => !SPECIFIC_PREFIXES.some((p) => k.startsWith(p)))
          : all.filter((k) => k.startsWith(prefix));

    for (const key of keys) {
      const raw = await this.redis.get(key);
      if (!raw) continue; // expired in L2 — skip
      try {
        const entry = JSON.parse(raw) as CacheEntry<unknown>;
        this.l3.write(key, entry);
      } catch (err) {
        this.logger.warn(`L3BatchWriter: corrupt L2 data for key=${key}: ${String(err)}`);
      }
    }
  }
}
