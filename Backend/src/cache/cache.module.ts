import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { JsonCacheService } from './json-cache.service';
import { CacheOrchestratorService } from './cache-orchestrator.service';
import { ImageCacheService } from './image-cache.service';

@Global()
@Module({
  providers: [RedisService, JsonCacheService, CacheOrchestratorService, ImageCacheService],
  exports: [CacheOrchestratorService, ImageCacheService],
})
export class CacheModule {}
