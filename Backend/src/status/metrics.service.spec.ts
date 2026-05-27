import { MetricsService } from './metrics.service';
import { RedisService } from '../cache/redis.service';

function makeRedis(): jest.Mocked<Pick<RedisService, 'set'>> {
  return { set: jest.fn().mockResolvedValue(undefined) };
}

function makeService(redis: ReturnType<typeof makeRedis>): MetricsService {
  const svc = new MetricsService(redis as unknown as RedisService);
  // Stub heavy async work so tests are fast
  jest.spyOn(svc, 'gatherMetrics').mockResolvedValue({
    nodeId: svc.nodeId,
    cpu: 0.1,
    freeMem: 8e9,
    latency: 5,
    timestamp: Date.now(),
  });
  return svc;
}

describe('MetricsService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('startup heartbeat', () => {
    it('publishes metrics to Redis immediately on onModuleInit — before any interval fires', async () => {
      jest.useFakeTimers();
      const redis = makeRedis();
      const svc = makeService(redis);

      svc.onModuleInit();
      // No timer advance — the publish should already be in flight
      await Promise.resolve(); // flush microtasks

      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        `cluster_metrics:${svc.nodeId}`,
        expect.any(String),
        expect.any(Number),
      );

      svc.onModuleDestroy();
      jest.useRealTimers();
    });

    it('also publishes on each interval tick', async () => {
      jest.useFakeTimers();
      const redis = makeRedis();
      const svc = makeService(redis);

      svc.onModuleInit();
      await Promise.resolve();

      jest.advanceTimersByTime(10_000);
      await Promise.resolve();

      expect(redis.set.mock.calls.length).toBeGreaterThanOrEqual(2);

      svc.onModuleDestroy();
      jest.useRealTimers();
    });
  });
});
