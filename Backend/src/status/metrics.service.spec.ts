import { MetricsService } from './metrics.service';
import { RedisService } from '../cache/redis.service';

const drainMicrotasks = async (n = 10) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

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

  describe('in-flight guard', () => {
    it('skips a concurrent publish — redis.set called once even if second publish fires before first settles', async () => {
      const redis = makeRedis();
      const svc = new MetricsService(redis as unknown as RedisService);

      // Never-resolving stub: first call hangs indefinitely
      let resolveFirst!: () => void;
      const firstDone = new Promise<void>(r => { resolveFirst = r; });
      jest.spyOn(svc, 'gatherMetrics')
        .mockImplementationOnce(() => firstDone.then(() => ({ nodeId: svc.nodeId, cpu: 0, freeMem: 0, latency: 0, timestamp: 0 })))
        .mockResolvedValue({ nodeId: svc.nodeId, cpu: 0, freeMem: 0, latency: 0, timestamp: 0 });

      const p1 = svc.publishMetrics(); // first call — hangs
      const p2 = svc.publishMetrics(); // second call — should be skipped
      await p2;                        // skipped call resolves immediately

      expect(redis.set).not.toHaveBeenCalled(); // first still in flight, second skipped

      resolveFirst();
      await p1;

      expect(redis.set).toHaveBeenCalledTimes(1); // only first call wrote to Redis
    });
  });

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
      await drainMicrotasks(); // let startup publish fully complete (including finally)

      jest.advanceTimersByTime(10_000);
      await drainMicrotasks(); // let interval publish fully complete

      expect(redis.set.mock.calls.length).toBeGreaterThanOrEqual(2);

      svc.onModuleDestroy();
      jest.useRealTimers();
    });
  });
});
