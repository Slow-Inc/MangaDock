import { Global, Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { DiskStorageProvider } from './disk-storage.provider';
import { CloudflareR2StorageProvider } from './cloudflare-r2.provider';
import { UploadsController } from './uploads.controller';

@Global()
@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: () => {
        const workerUrl = process.env.WORKER_URL?.trim();
        const workerSecret = process.env.WORKER_SECRET?.trim();
        if (workerUrl && workerSecret) {
          return new CloudflareR2StorageProvider(workerUrl, workerSecret);
        }
        return new DiskStorageProvider();
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
