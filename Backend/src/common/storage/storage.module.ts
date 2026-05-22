import { Global, Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { DiskStorageProvider } from './disk-storage.provider';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass: DiskStorageProvider, // Default to Disk for now
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
