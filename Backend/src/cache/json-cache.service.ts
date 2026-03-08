import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type CacheEntry<T> = {
  key?: string; // original cache key, used to restore memoryStore correctly
  data: T;
  updatedAt: string;
  ttlMs: number;
};

@Injectable()
export class JsonCacheService implements OnModuleInit {
  private readonly logger = new Logger(JsonCacheService.name);
  private readonly cacheDir: string;
  private memoryStore = new Map<string, CacheEntry<unknown>>();

  constructor() {
    this.cacheDir = path.resolve(process.cwd(), '.cache');
  }

  onModuleInit() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    this.loadAllFromDisk();
  }

  private loadAllFromDisk() {
    try {
      const files = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const entry = JSON.parse(raw) as CacheEntry<unknown>;
        // Use the key stored inside the JSON (original key with colons etc.)
        // Fall back to filename-derived key for backward compat
        const memKey = entry.key ?? file.replace('.json', '');
        this.memoryStore.set(memKey, entry);
      }
      this.logger.log(`Loaded ${files.length} cache entries from disk`);
    } catch (err) {
      this.logger.warn(`Failed to load cache from disk: ${String(err)}`);
    }
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.memoryStore.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    return entry;
  }

  isExpired<T>(entry: CacheEntry<T>): boolean {
    if (entry.ttlMs <= 0) return false;
    const age = Date.now() - new Date(entry.updatedAt).getTime();
    return age > entry.ttlMs;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    const entry: CacheEntry<T> = {
      key, // store original key so loadAllFromDisk can restore correctly
      data,
      updatedAt: new Date().toISOString(),
      ttlMs,
    };
    this.memoryStore.set(key, entry);
    this.writeToDisk(key, entry);
  }

  syncEntry<T>(key: string, entry: CacheEntry<T>): void {
    const existing = this.memoryStore.get(key);
    if (
      !existing ||
      new Date(entry.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
    ) {
      this.memoryStore.set(key, entry);
      this.writeToDisk(key, entry);
      this.logger.log(`JSON cache synced newer data for key: ${key}`);
    }
  }

  getAll(): Map<string, CacheEntry<unknown>> {
    return this.memoryStore;
  }

  private writeToDisk<T>(key: string, entry: CacheEntry<T>): void {
    try {
      // Sanitize key for Windows-safe filename (: * ? " < > | \ / are invalid)
      const safeFileName = key.replace(/[:\\/*?"<>|]/g, '_');
      const filePath = path.join(this.cacheDir, `${safeFileName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`Failed to write cache to disk [${key}]: ${String(err)}`);
    }
  }
}
