/**
 * Debug utility — wipe every translated-patch cache layer so the next MIT run
 * re-translates from scratch instead of replaying a stale result (#MIT-debug).
 *
 *   npm run cache:reset            # delete for real
 *   npm run cache:reset -- --dry-run   # list what would be deleted, touch nothing
 *
 * Clears: Redis `translate:manga-patches:*`, L3 disk `.cache/*.json` patch
 * entries, and the `uploads/patches/<chapterId>` PNG trees. Leaves forum/search/
 * mangadex/glossary caches untouched (selection lives in the unit-tested
 * `translation-cache-reset` module). The in-memory L1 cache is process-local and
 * dies with the backend, so a restart clears it — nothing to do here.
 */
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

import {
  resetTranslationCache,
  TRANSLATED_PATCH_PREFIX,
  type CacheResetPorts,
} from '../src/cache/translation-cache-reset';

const DRY_RUN = process.argv.includes('--dry-run');
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const PATCH_ROOT = path.resolve(process.cwd(), 'uploads', 'patches');

/** Connect to Redis with a short fuse; return null (and warn) if unreachable,
 *  mirroring RedisService's "JSON cache only" fallback so the sweep still runs. */
async function connectRedis(): Promise<Redis | null> {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
  const client = new Redis({
    host,
    port,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  // Without a handler ioredis prints "Unhandled error event" on a failed connect.
  client.on('error', () => {});
  try {
    await client.connect();
    return client;
  } catch (err) {
    console.warn(`⚠ Redis unreachable at ${host}:${port} — skipping Redis layer (${String(err)})`);
    client.disconnect();
    return null;
  }
}

/** Map each L3 `.json` file to its canonical cache key (the `key` field). */
function readL3Keys(): Map<string, string> {
  const byKey = new Map<string, string>(); // canonicalKey -> absolute file path
  if (!fs.existsSync(CACHE_DIR)) return byKey;
  for (const file of fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'))) {
    const filePath = path.join(CACHE_DIR, file);
    try {
      const entry = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { key?: string };
      const key = entry.key ?? file.replace(/\.json$/, '');
      byKey.set(key, filePath);
    } catch {
      /* corrupt file — not a patch entry we can identify, leave it */
    }
  }
  return byKey;
}

/** Recursively delete a directory, returning the number of files removed. */
function rmDirCountFiles(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += rmDirCountFiles(full);
    else {
      fs.rmSync(full);
      count += 1;
    }
  }
  fs.rmdirSync(dir);
  return count;
}

async function main(): Promise<void> {
  const redis = await connectRedis();
  const l3Keys = readL3Keys();

  const ports: CacheResetPorts = {
    listRedisKeys: async () =>
      redis ? redis.keys(`${TRANSLATED_PATCH_PREFIX}*`) : [],
    deleteRedisKeys: async (keys) =>
      DRY_RUN || !redis || keys.length === 0 ? keys.length : redis.del(...keys),
    listL3Keys: async () => [...l3Keys.keys()],
    deleteL3Key: async (key) => {
      const file = l3Keys.get(key);
      if (file && !DRY_RUN) fs.rmSync(file);
    },
    listPatchChapters: async () =>
      fs.existsSync(PATCH_ROOT)
        ? fs
            .readdirSync(PATCH_ROOT, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
        : [],
    deletePatchChapter: async (chapterId) => {
      const dir = path.join(PATCH_ROOT, chapterId);
      if (DRY_RUN) {
        return fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length;
      }
      return rmDirCountFiles(dir);
    },
  };

  const report = await resetTranslationCache(ports);
  if (redis) redis.disconnect();

  const tag = DRY_RUN ? '[dry-run] would delete' : 'deleted';
  console.log(
    `✓ ${tag}: ${report.redisKeys} Redis key(s), ${report.l3Files} L3 file(s), ` +
      `${report.patchFiles} patch PNG(s) across ${report.patchChapters} chapter(s)`,
  );
  if (!DRY_RUN) {
    // This clears disk + Redis but NOT a running backend's in-memory L1 cache,
    // which would keep serving patch URLs for the PNGs we just deleted → 404.
    console.log('⚠ Restart the backend to clear its in-memory L1 cache (else stale patch URLs → 404).');
  }
}

main().catch((err) => {
  console.error('cache:reset failed:', err);
  process.exit(1);
});
