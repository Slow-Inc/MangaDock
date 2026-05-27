import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JsonCacheService } from './json-cache.service';
import { CacheOrchestratorService } from './cache-orchestrator.service';
import { ImageCacheService } from './image-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';
import { StatusModule } from '../status/status.module';

@Global()
@Module({
  imports: [StatusModule],
  providers: [RedisService, JsonCacheService, CacheOrchestratorService, ImageCacheService, BatchSyncWorker],
  exports: [CacheOrchestratorService, ImageCacheService, RedisService],
})
export class CacheModule {}
