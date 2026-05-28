import { StatsIncrementService } from './stats-increment.service';
import { RedisService } from './redis.service';

function makeRedis(): jest.Mocked<Pick<RedisService, 'available' | 'incr' | 'pfadd' | 'sadd' | 'expire' | 'set'>> {
  return {
    available: true,
    incr: jest.fn().mockResolvedValue(1),
    pfadd: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeService(redis = makeRedis()) {
  return { svc: new StatsIncrementService(redis as unknown as RedisService), redis };
}

describe('StatsIncrementService', () => {
  afterEach(() => jest.restoreAllMocks());

  // Cycle 1 — increments view counter
  it('recordChapterView increments the view counter for the chapter on the given date', async () => {
    const { svc, redis } = makeService();

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(redis.incr).toHaveBeenCalledWith('stats:chapter:ch:1:views:2026-05-28');
  });

  // Cycle 2 — adds uid to HyperLogLog
  it('recordChapterView adds the uid to the unique-readers HyperLogLog', async () => {
    const { svc, redis } = makeService();

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(redis.pfadd).toHaveBeenCalledWith('stats:chapter:ch:1:hll:2026-05-28', 'uid:x');
  });

  // Cycle 3 — adds chapterId to active set
  it('recordChapterView adds the chapterId to the active set for the date', async () => {
    const { svc, redis } = makeService();

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(redis.sadd).toHaveBeenCalledWith('stats:active:2026-05-28', 'ch:1');
  });

  // Cycle 4 — sets TTL on all keys
  it('recordChapterView sets TTL on all three keys', async () => {
    const { svc, redis } = makeService();

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(redis.expire).toHaveBeenCalledTimes(3);
    const keys = redis.expire.mock.calls.map(([k]) => k);
    expect(keys).toContain('stats:chapter:ch:1:views:2026-05-28');
    expect(keys).toContain('stats:chapter:ch:1:hll:2026-05-28');
    expect(keys).toContain('stats:active:2026-05-28');
  });

  // Cycle 5 — Redis unavailable: no-op
  it('recordChapterView does nothing when Redis is unavailable', async () => {
    const redis = makeRedis();
    redis.available = false;
    const { svc } = makeService(redis);

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.pfadd).not.toHaveBeenCalled();
    expect(redis.sadd).not.toHaveBeenCalled();
  });

  // Cycle 6 — stores manga_id so StatsFlushWorker can resolve it
  it('recordChapterView stores mangaId under the chapter manga key', async () => {
    const { svc, redis } = makeService();

    await svc.recordChapterView('ch:1', 'manga:A', 'uid:x', '2026-05-28');

    expect(redis.set).toHaveBeenCalledWith(
      'stats:chapter:ch:1:manga:2026-05-28',
      'manga:A',
      expect.any(Number),
    );
  });
});
