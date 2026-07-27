import { MetricsService } from './metrics.service';
import { RedisService } from '../cache/redis.service';

const drainMicrotasks = async (n = 10) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

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

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('MetricsService — nodeId (#42)', () => {
  // Cycle 1 — nodeId embeds a UUID v4 segment for global uniqueness across containers
  it('nodeId contains a UUID v4 segment after the PID', () => {
    const redis = makeRedis();
    const svc = new MetricsService(redis as unknown as RedisService);
    // format: node-<pid>-<uuid-v4>  e.g. node-1234-550e8400-e29b-41d4-a716-446655440000
    const uuidPart = svc.nodeId.replace(/^node-\d+-/, '');
    expect(UUID_V4_RE.test(uuidPart)).toBe(true);
  });

  // Cycle 2 — prefix stays human-readable
  it('nodeId starts with node-<pid>- so log lines remain identifiable', () => {
    const redis = makeRedis();
    const svc = new MetricsService(redis as unknown as RedisService);
    expect(svc.nodeId).toMatch(new RegExp(`^node-${process.pid}-`));
  });

  // Cycle 3 — UUID guarantees uniqueness even when pid is identical (Docker containers)
  it('two MetricsService instances have different nodeIds', () => {
    const a = new MetricsService(makeRedis() as unknown as RedisService);
    const b = new MetricsService(makeRedis() as unknown as RedisService);
    expect(a.nodeId).not.toBe(b.nodeId);
  });
});

describe('MetricsService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('in-flight guard', () => {
    it('skips a concurrent publish — redis.set called once even if second publish fires before first settles', async () => {
      const redis = makeRedis();
      const svc = new MetricsService(redis as unknown as RedisService);

      // Never-resolving stub: first call hangs indefinitely
      let resolveFirst!: () => void;
      const firstDone = new Promise<void>((r) => {
        resolveFirst = r;
      });
      jest
        .spyOn(svc, 'gatherMetrics')
        .mockImplementationOnce(() =>
          firstDone.then(() => ({
            nodeId: svc.nodeId,
            cpu: 0,
            freeMem: 0,
            latency: 0,
            timestamp: 0,
          })),
        )
        .mockResolvedValue({
          nodeId: svc.nodeId,
          cpu: 0,
          freeMem: 0,
          latency: 0,
          timestamp: 0,
        });

      const p1 = svc.publishMetrics(); // first call — hangs
      const p2 = svc.publishMetrics(); // second call — should be skipped
      await p2; // skipped call resolves immediately

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
