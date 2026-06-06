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
  /** updatedAt last written to L3 per key — unchanged entries skip the disk
   *  write (#147). Every set() stamps a fresh updatedAt, so equality means
   *  "no write since the last flush". */
  private readonly lastWritten = new Map<string, string>();

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

    // Prune high-water marks for keys evicted from L1 — without this the map
    // grows forever under key churn (manga chapters rotate through the LRU).
    for (const key of this.lastWritten.keys()) {
      if (matchesPrefix(key) && !all.has(key)) this.lastWritten.delete(key);
    }

    // One MGET round-trip instead of one GET per key (#147) — these timers
    // fire every 2s/5s/60s forever, so per-key RTTs were a standing tax.
    const keys = [...all.keys()].filter(matchesPrefix);
    if (keys.length === 0) return;
    const raws = await this.redis.mget(keys);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const raw = raws[i];
      if (!raw) continue; // expired in L2 — skip
      try {
        const entry = JSON.parse(raw) as CacheEntry<unknown>;
        if (this.lastWritten.get(key) === entry.updatedAt) continue; // unchanged since last flush
        this.l3.write(key, entry);
        this.lastWritten.set(key, entry.updatedAt);
      } catch (err) {
        this.logger.warn(`L3BatchWriter: corrupt L2 data for key=${key}: ${String(err)}`);
      }
    }
  }
}
