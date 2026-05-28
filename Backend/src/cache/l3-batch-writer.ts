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
    await this.flush(); // sync L2→L3 for any keys Redis holds on startup; no-op if Redis is cold after a crash restart
    for (const { prefix, intervalMs } of FLUSH_CONFIG) {
      const timer = setInterval(() => void this.flush(prefix), intervalMs);
      this.timers.push(timer);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.flush(); // final flush while Redis is still live (runs before RedisService.onModuleDestroy)
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }

  async flush(prefix?: string): Promise<void> {
    const all = this.jsonCache.getAll();
    const matchesPrefix = (k: string) =>
      prefix === undefined
        ? true
        : prefix === ''
          ? !SPECIFIC_PREFIXES.some((p) => k.startsWith(p))
          : k.startsWith(prefix);

    if (!this.redis.available) {
      // L1→L3 direct path: Redis unavailable (e.g., provider destroyed before us on shutdown)
      for (const [key, entry] of all) {
        if (matchesPrefix(key)) this.l3.write(key, entry);
      }
      return;
    }

    for (const key of [...all.keys()].filter(matchesPrefix)) {
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
