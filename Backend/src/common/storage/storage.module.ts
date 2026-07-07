import { Global, Logger, Module } from '@nestjs/common';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from './storage-provider.interface';
import { DiskStorageProvider } from './disk-storage.provider';
import { CloudflareR2StorageProvider } from './cloudflare-r2.provider';
import { UploadsController } from './uploads.controller';
import { ImgCacheController } from './img-cache.controller';

/**
 * Select the storage backend.
 *
 * `STORAGE_DRIVER` (explicit) wins — handy in development to force local disk
 * even when R2 worker creds are present in the env, or vice-versa:
 *   - `disk` | `local`      → {@link DiskStorageProvider}
 *   - `r2`   | `cloudflare`  → {@link CloudflareR2StorageProvider}
 *
 * When `STORAGE_DRIVER` is unset/empty we fall back to the original auto-detect:
 * R2 when both `WORKER_URL` and `WORKER_SECRET` are set, local disk otherwise.
 * This keeps existing deployments byte-for-byte unchanged.
 *
 * Pure and env-injectable so the selection logic is unit-testable in isolation.
 */
export function createStorageProvider(
  env: NodeJS.ProcessEnv = process.env,
  logger: Logger = new Logger('StorageModule'),
): StorageProvider {
  const driver = env.STORAGE_DRIVER?.trim().toLowerCase();
  const workerUrl = env.WORKER_URL?.trim();
  const workerSecret = env.WORKER_SECRET?.trim();
  const hasR2Creds = Boolean(workerUrl && workerSecret);

  let useR2: boolean;
  if (driver === 'r2' || driver === 'cloudflare') {
    useR2 = true;
  } else if (driver === 'disk' || driver === 'local') {
    useR2 = false;
  } else if (driver) {
    throw new Error(
      `Unknown STORAGE_DRIVER="${driver}" — use one of: disk, local, r2, cloudflare (or leave unset to auto-detect)`,
    );
  } else {
    useR2 = hasR2Creds; // unset → auto-detect (backward compatible)
  }

  if (useR2) {
    if (!hasR2Creds) {
      throw new Error(
        'STORAGE_DRIVER=r2 requires WORKER_URL and WORKER_SECRET to be set',
      );
    }
    logger.log(`storage backend: Cloudflare R2 (driver=${driver ?? 'auto'})`);
    return new CloudflareR2StorageProvider(workerUrl as string, workerSecret as string);
  }

  logger.log(`storage backend: local disk (driver=${driver ?? 'auto'})`);
  return new DiskStorageProvider();
}

@Global()
@Module({
  controllers: [UploadsController, ImgCacheController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: () => createStorageProvider(),
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
