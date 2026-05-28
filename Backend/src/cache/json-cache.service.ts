import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { L3DiskService } from './l3-disk.service';

export type CacheEntry<T> = {
  key?: string;
  data: T;
  updatedAt: string;
  ttlMs: number;
};

const L1_MAX_ENTRIES = 10_000;

@Injectable()
export class JsonCacheService implements OnModuleInit {
  private readonly logger = new Logger(JsonCacheService.name);
  private readonly memoryStore = new LRUCache<string, CacheEntry<unknown>>({ max: L1_MAX_ENTRIES });

  constructor(private readonly l3: L3DiskService) {}

  onModuleInit() {
    const entries = this.l3.readAll();
    for (const [key, entry] of entries) {
      this.memoryStore.set(key, entry);
    }
    this.logger.log(`Loaded ${entries.size} entries from L3 disk into L1 (max=${L1_MAX_ENTRIES})`);
  }

  get<T>(key: string): CacheEntry<T> | null {
    return (this.memoryStore.get(key) as CacheEntry<T> | undefined) ?? null;
  }

  isExpired<T>(entry: CacheEntry<T>): boolean {
    if (entry.ttlMs <= 0) return false;
    const age = Date.now() - new Date(entry.updatedAt).getTime();
    return age > entry.ttlMs;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.memoryStore.set(key, { key, data, updatedAt: new Date().toISOString(), ttlMs });
  }

  delete(key: string): void {
    this.memoryStore.delete(key);
  }

  getAll(): Map<string, CacheEntry<unknown>> {
    return new Map(this.memoryStore.entries());
  }
}
