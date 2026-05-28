import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { L3DiskService } from './l3-disk.service';
import { L3BatchWriter } from './l3-batch-writer';
import { JsonCacheService } from './json-cache.service';
import { CacheOrchestratorService } from './cache-orchestrator.service';
import { ImageCacheService } from './image-cache.service';
import { BatchSyncWorker } from './batch-sync.worker';
import { StatsIncrementService } from './stats-increment.service';
import { StatsFlushWorker } from './stats-flush.worker';
import { StatusModule } from '../status/status.module';

@Global()
@Module({
  imports: [StatusModule],
  providers: [
    RedisService,
    L3DiskService,
    L3BatchWriter,
    JsonCacheService,
    CacheOrchestratorService,
    ImageCacheService,
    BatchSyncWorker,
    StatsIncrementService,
    StatsFlushWorker,
  ],
  exports: [CacheOrchestratorService, ImageCacheService, RedisService, StatsIncrementService],
})
export class CacheModule {}
