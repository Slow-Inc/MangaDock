import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { CacheEntry } from './json-cache.service';

@Injectable()
export class L3DiskService {
  private readonly logger = new Logger(L3DiskService.name);
  private readonly cacheDir: string;

  constructor(@Optional() @Inject('L3_CACHE_DIR') cacheDir?: string) {
    this.cacheDir = cacheDir ?? path.resolve(process.cwd(), '.cache');
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
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const safeFileName = key.replace(/[:\\/*?"<>|]/g, '_');
      const filePath = path.join(this.cacheDir, `${safeFileName}.json`);
      fs.writeFileSync(filePath, JSON.stringify({ ...entry, key }, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`Failed to write L3 cache [${key}]: ${String(err)}`);
    }
  }
}
