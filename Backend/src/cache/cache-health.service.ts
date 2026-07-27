import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { L3DiskService } from './l3-disk.service';
import { ElectionService } from '../status/election.service';
import {
  DIRTY_QUEUE,
  PROCESSING_QUEUE,
  DEAD_LETTER_SET,
} from './batch-sync.worker';

export interface CacheHealthSnapshot {
  dirtyQueueDepth: number;
  processingQueueDepth: number;
  deadLetterCount: number;
  l3KeyCount: number;
  isLeader: boolean;
}

@Injectable()
export class CacheHealthService {
  constructor(
    private readonly redis: RedisService,
    private readonly l3: L3DiskService,
    private readonly election: ElectionService,
  ) {}

  async getHealth(): Promise<CacheHealthSnapshot> {
    const [dirtyQueueDepth, processingQueueDepth, deadLetterCount] = this.redis
      .available
      ? await Promise.all([
          this.redis.llen(DIRTY_QUEUE),
          this.redis.llen(PROCESSING_QUEUE),
          this.redis.scard(DEAD_LETTER_SET),
        ])
      : [0, 0, 0];

    return {
      dirtyQueueDepth,
      processingQueueDepth,
      deadLetterCount,
      l3KeyCount: this.l3.keyCount(),
      isLeader: this.election.isLeader,
    };
  }
}
