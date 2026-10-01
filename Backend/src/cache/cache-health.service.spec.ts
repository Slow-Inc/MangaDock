import { CacheHealthService } from './cache-health.service';
import { RedisService } from './redis.service';
import { L3DiskService } from './l3-disk.service';
import { ElectionService } from '../status/election.service';
import {
  DIRTY_QUEUE,
  PROCESSING_QUEUE,
  DEAD_LETTER_SET,
} from './batch-sync.worker';

function makeRedis(
  overrides: Partial<{ available: boolean; llen: number; scard: number }> = {},
) {
  const { available = true, llen = 0, scard = 0 } = overrides;
  return {
    available,
    llen: jest.fn().mockResolvedValue(llen),
    scard: jest.fn().mockResolvedValue(scard),
  } as unknown as RedisService;
}

function makeL3(keyCount = 0) {
  return {
    keyCount: jest.fn().mockReturnValue(keyCount),
  } as unknown as L3DiskService;
}

function makeElection(isLeader = false) {
  return { isLeader } as unknown as ElectionService;
}

function makeService(
  overrides: {
    redis?: ReturnType<typeof makeRedis>;
    l3?: ReturnType<typeof makeL3>;
    election?: ReturnType<typeof makeElection>;
  } = {},
) {
  const redis = overrides.redis ?? makeRedis();
  const l3 = overrides.l3 ?? makeL3();
  const election = overrides.election ?? makeElection();
  const svc = new CacheHealthService(redis, l3, election);
  return { svc, redis, l3, election };
}

describe('CacheHealthService', () => {
  // H1 — Tracer bullet: dirtyQueueDepth = LLEN cache:dirty
  it('returns dirtyQueueDepth equal to LLEN cache:dirty', async () => {
    const redis = makeRedis({ llen: 7 });
    const { svc } = makeService({ redis });

    const result = await svc.getHealth();

    expect(redis.llen).toHaveBeenCalledWith(DIRTY_QUEUE);
    expect(result.dirtyQueueDepth).toBe(7);
  });

  // H2 — processingQueueDepth = LLEN cache:processing
  it('returns processingQueueDepth equal to LLEN cache:processing', async () => {
    const redis = makeRedis({ llen: 3 });
    const { svc } = makeService({ redis });

    const result = await svc.getHealth();

    expect(redis.llen).toHaveBeenCalledWith(PROCESSING_QUEUE);
    expect(result.processingQueueDepth).toBe(3);
  });

  // H3 — deadLetterCount = SCARD cache:dead_letter
  it('returns deadLetterCount equal to SCARD cache:dead_letter', async () => {
    const redis = makeRedis({ scard: 2 });
    const { svc } = makeService({ redis });

    const result = await svc.getHealth();

    expect(redis.scard).toHaveBeenCalledWith(DEAD_LETTER_SET);
    expect(result.deadLetterCount).toBe(2);
  });

  // H4 — l3KeyCount = number of JSON files
  it('returns l3KeyCount from L3DiskService.keyCount()', async () => {
    const l3 = makeL3(412);
    const { svc } = makeService({ l3 });

    const result = await svc.getHealth();

    expect(l3.keyCount).toHaveBeenCalled();
    expect(result.l3KeyCount).toBe(412);
  });

  // H5 — isLeader from ElectionService
  it('returns isLeader from ElectionService', async () => {
    const { svc } = makeService({ election: makeElection(true) });

    const result = await svc.getHealth();

    expect(result.isLeader).toBe(true);
  });

  // H6 — Redis unavailable: all Redis counters are 0
  it('returns all-zero Redis counters when Redis is unavailable', async () => {
    const redis = makeRedis({ available: false });
    const { svc } = makeService({ redis });

    const result = await svc.getHealth();

    expect(result.dirtyQueueDepth).toBe(0);
    expect(result.processingQueueDepth).toBe(0);
    expect(result.deadLetterCount).toBe(0);
  });
});
