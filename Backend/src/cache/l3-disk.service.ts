import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { CacheEntry } from './json-cache.service';

const CONSECUTIVE_FAIL_THRESHOLD = 3;

@Injectable()
export class L3DiskService {
  private readonly logger = new Logger(L3DiskService.name);
  private readonly cacheDir: string;
  private consecutiveWriteFailures = 0;
  private criticalAlertFired = false;

  constructor(@Optional() @Inject('L3_CACHE_DIR') cacheDir?: string) {
    this.cacheDir = cacheDir ?? path.resolve(process.cwd(), '.cache');
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch (err) {
      this.logger.warn(`L3DiskService: could not create cache dir ${this.cacheDir}: ${String(err)}`);
    }
  }

  readAll(): Map<string, CacheEntry<unknown>> {
    const map = new Map<string, CacheEntry<unknown>>();
    try {
      if (!fs.existsSync(this.cacheDir)) return map;
      const files = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const entry = JSON.parse(raw) as CacheEntry<unknown> & { key?: string };
          const memKey = entry.key ?? file.replace('.json', '');
          map.set(memKey, entry);
        } catch {
          this.logger.warn(`Skipping corrupt L3 cache file: ${file}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to read L3 cache dir: ${String(err)}`);
    }
    return map;
  }

  write<T>(key: string, entry: CacheEntry<T>): void {
    try {
      const safeFileName = key.replace(/[:\\/*?"<>|]/g, '_');
      const filePath = path.join(this.cacheDir, `${safeFileName}.json`);
      this.writeFile(filePath, JSON.stringify({ ...entry, key }, null, 2));
      this.consecutiveWriteFailures = 0;
      this.criticalAlertFired = false;
    } catch (err) {
      this.consecutiveWriteFailures++;
      this.logger.warn(`Failed to write L3 cache [${key}]: ${String(err)}`);
      if (this.consecutiveWriteFailures >= CONSECUTIVE_FAIL_THRESHOLD && !this.criticalAlertFired) {
        this.criticalAlertFired = true;
        this.logger.error(
          `CRITICAL: L3 disk write has failed ${this.consecutiveWriteFailures} consecutive times — possible disk full or permission error`,
        );
      }
    }
  }

  appendDirtyFallback(key: string): void {
    const fallbackPath = path.join(this.cacheDir, 'dirty_fallback.json');
    try {
      let keys: string[] = [];
      if (fs.existsSync(fallbackPath)) {
        keys = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8')) as string[];
      }
      keys.push(key);
      fs.writeFileSync(fallbackPath, JSON.stringify(keys), 'utf-8');
    } catch (err) {
      this.logger.warn(`appendDirtyFallback: failed for key=${key}: ${String(err)}`);
    }
  }

  drainDirtyFallback(): string[] {
    const fallbackPath = path.join(this.cacheDir, 'dirty_fallback.json');
    try {
      if (!fs.existsSync(fallbackPath)) return [];
      const keys = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8')) as string[];
      fs.unlinkSync(fallbackPath);
      return Array.isArray(keys) ? keys : [];
    } catch (err) {
      this.logger.warn(`drainDirtyFallback: failed: ${String(err)}`);
      return [];
    }
  }

  protected writeFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
