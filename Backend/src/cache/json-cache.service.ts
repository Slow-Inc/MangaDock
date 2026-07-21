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
const L1_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class JsonCacheService implements OnModuleInit {
  private readonly logger = new Logger(JsonCacheService.name);
  private readonly memoryStore = new LRUCache<string, CacheEntry<unknown>>({
    max: L1_MAX_ENTRIES,
    maxSize: L1_MAX_SIZE_BYTES,
    sizeCalculation: (value, key) =>
      key.length + JSON.stringify(value.data).length,
  });

  constructor(private readonly l3: L3DiskService) {}

  onModuleInit() {
    const entries = this.l3.readAll();
    for (const [key, entry] of entries) {
      this.memoryStore.set(key, entry);
    }
    this.logger.log(
      `Loaded ${entries.size} entries from L3 disk into L1 (max=${L1_MAX_ENTRIES})`,
    );
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
    this.memoryStore.set(key, {
      key,
      data,
      updatedAt: new Date().toISOString(),
      ttlMs,
    });
  }

  delete(key: string): void {
    this.memoryStore.delete(key);
  }

  clear(): void {
    this.memoryStore.clear();
  }

  /**
   * Live iteration over the L1 store — consumers (L3 batch writer, L2 recovery)
   * snapshot what they need synchronously before any await. Returns a fresh
   * iterator over the backing LRU each call WITHOUT cloning the whole map
   * (the old getAll() rebuilt a 10k-entry Map several times per second). (FR-5)
   */
  entries(): IterableIterator<[string, CacheEntry<unknown>]> {
    return this.memoryStore.entries();
  }

  keys(): IterableIterator<string> {
    return this.memoryStore.keys();
  }

  has(key: string): boolean {
    return this.memoryStore.has(key);
  }

  /** Read an entry without affecting LRU recency (mirrors the old plain-Map read). */
  peek<T>(key: string): CacheEntry<T> | null {
    return (this.memoryStore.peek(key) as CacheEntry<T> | undefined) ?? null;
  }
}
