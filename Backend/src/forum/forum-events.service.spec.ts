import { ForumEventsService } from './forum-events.service';
import type { RedisService } from '../cache/redis.service';

type SubscribeHandler = (data: unknown) => void;
type Unsubscribe = () => void;

interface RedisMock {
  available: boolean;
  publish: jest.Mock<Promise<boolean>, [string, unknown]>;
  subscribe: jest.Mock<Unsubscribe, [string, SubscribeHandler]>;
}

function makeRedisMock(overrides: Partial<RedisMock> = {}): RedisMock {
  return {
    available: true,
    publish: jest
      .fn<Promise<boolean>, [string, unknown]>()
      .mockResolvedValue(true),
    subscribe: jest
      .fn<Unsubscribe, [string, SubscribeHandler]>()
      .mockReturnValue(jest.fn()),
    ...overrides,
  };
}

function newService(redis: RedisMock): ForumEventsService {
  return new ForumEventsService(redis as unknown as RedisService);
}

function subscribeCallbackFor(
  redis: RedisMock,
  channel: string,
): (data: unknown) => void {
  const call = redis.subscribe.mock.calls.find((c) => c[0] === channel);
  if (!call)
    throw new Error(
      `redis.subscribe was never called for channel "${channel}"`,
    );
  return call[1];
}

describe('ForumEventsService', () => {
  describe('broadcastPostEvent', () => {
    it('delivers to a getPostStream subscriber and publishes to redis when available', async () => {
      const redis = makeRedisMock({ available: true });
      const service = newService(redis);
      const received: unknown[] = [];
      service.getPostStream('p1').subscribe((msg) => received.push(msg));

      const event = { type: 'post_deleted' as const, postId: 'p1' };
      await service.broadcastPostEvent(event);

      expect(received).toEqual([{ data: event }]);
      expect(redis.publish).toHaveBeenCalledTimes(1);
      expect(redis.publish).toHaveBeenCalledWith(
        'forum:events',
        expect.objectContaining({ ...event, _src: expect.any(String) }),
      );
    });

    it('still delivers locally but does not call redis.publish when redis is unavailable', async () => {
      const redis = makeRedisMock({ available: false });
      const service = newService(redis);
      const received: unknown[] = [];
      service.getPostStream('p1').subscribe((msg) => received.push(msg));

      const event = { type: 'post_deleted' as const, postId: 'p1' };
      await service.broadcastPostEvent(event);

      expect(received).toEqual([{ data: event }]);
      expect(redis.publish).not.toHaveBeenCalled();
    });

    it('swallows a redis publish rejection (logs a warning) without throwing; local delivery unaffected', async () => {
      const redis = makeRedisMock({
        available: true,
        publish: jest
          .fn<Promise<boolean>, [string, unknown]>()
          .mockRejectedValue(new Error('ECONNRESET')),
      });
      const service = newService(redis);
      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: (msg: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      const received: unknown[] = [];
      service.getPostStream('p1').subscribe((msg) => received.push(msg));

      const event = { type: 'post_deleted' as const, postId: 'p1' };
      await expect(service.broadcastPostEvent(event)).resolves.toBeUndefined();

      expect(received).toEqual([{ data: event }]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('broadcastFeedEvent', () => {
    it('delivers to a getFeedStream subscriber and publishes to redis when available', async () => {
      const redis = makeRedisMock({ available: true });
      const service = newService(redis);
      const received: unknown[] = [];
      service.getFeedStream().subscribe((msg) => received.push(msg));

      const event = {
        type: 'new_post' as const,
        id: 'p1',
        title: 'T',
        authorName: null,
        authorPhotoUrl: null,
        category: 'general',
        createdAt: '2024-01-01T00:00:00Z',
      };
      await service.broadcastFeedEvent(event);

      expect(received).toEqual([{ data: event }]);
      expect(redis.publish).toHaveBeenCalledWith(
        'forum:feed',
        expect.objectContaining({ ...event, _src: expect.any(String) }),
      );
    });

    it('still delivers locally but does not call redis.publish when redis is unavailable', async () => {
      const redis = makeRedisMock({ available: false });
      const service = newService(redis);
      const received: unknown[] = [];
      service.getFeedStream().subscribe((msg) => received.push(msg));

      const event = {
        type: 'new_post' as const,
        id: 'p1',
        title: 'T',
        authorName: null,
        authorPhotoUrl: null,
        category: 'general',
        createdAt: '2024-01-01T00:00:00Z',
      };
      await service.broadcastFeedEvent(event);

      expect(received).toEqual([{ data: event }]);
      expect(redis.publish).not.toHaveBeenCalled();
    });
  });

  describe('getPostStream', () => {
    it('filters by postId — a subscriber for p1 does not receive an event for p2, and vice versa', async () => {
      const redis = makeRedisMock({ available: false });
      const service = newService(redis);
      const receivedP1: unknown[] = [];
      const receivedP2: unknown[] = [];
      service.getPostStream('p1').subscribe((msg) => receivedP1.push(msg));
      service.getPostStream('p2').subscribe((msg) => receivedP2.push(msg));

      await service.broadcastPostEvent({ type: 'post_deleted', postId: 'p2' });

      expect(receivedP1).toHaveLength(0);
      expect(receivedP2).toHaveLength(1);
    });
  });

  describe('onModuleInit', () => {
    it('subscribes to both the forum:events and forum:feed redis channels', () => {
      const redis = makeRedisMock();
      const service = newService(redis);

      service.onModuleInit();

      expect(redis.subscribe).toHaveBeenCalledTimes(2);
      expect(redis.subscribe).toHaveBeenCalledWith(
        'forum:events',
        expect.any(Function),
      );
      expect(redis.subscribe).toHaveBeenCalledWith(
        'forum:feed',
        expect.any(Function),
      );
    });

    it('forwards a redis-delivered post event tagged with a different instance id (stripped of _src)', () => {
      const redis = makeRedisMock();
      const service = newService(redis);
      service.onModuleInit();
      const postChannelCb = subscribeCallbackFor(redis, 'forum:events');

      const received: unknown[] = [];
      service.getPostStream('p1').subscribe((msg) => received.push(msg));

      postChannelCb({
        type: 'post_deleted',
        postId: 'p1',
        _src: 'someOtherInstance',
      });

      expect(received).toEqual([
        { data: { type: 'post_deleted', postId: 'p1' } },
      ]);
    });

    it('forwards a redis-delivered feed event tagged with a different instance id (stripped of _src)', () => {
      const redis = makeRedisMock();
      const service = newService(redis);
      service.onModuleInit();
      const feedChannelCb = subscribeCallbackFor(redis, 'forum:feed');

      const received: unknown[] = [];
      service.getFeedStream().subscribe((msg) => received.push(msg));
      const feedEvent = {
        type: 'new_post',
        id: 'p1',
        title: 'T',
        authorName: null,
        authorPhotoUrl: null,
        category: 'general',
        createdAt: '2024-01-01T00:00:00Z',
      };

      feedChannelCb({ ...feedEvent, _src: 'someOtherInstance' });

      expect(received).toEqual([{ data: feedEvent }]);
    });

    it('skips a redis-delivered event tagged with this instance own _src (dedup, no double delivery)', async () => {
      const redis = makeRedisMock({ available: true });
      const service = newService(redis);
      service.onModuleInit();
      const postChannelCb = subscribeCallbackFor(redis, 'forum:events');

      const received: unknown[] = [];
      service.getPostStream('p1').subscribe((msg) => received.push(msg));

      const event = { type: 'post_deleted' as const, postId: 'p1' };
      // Local delivery #1 happens synchronously inside broadcastPostEvent; the awaited
      // redis.publish call captures the real (private) instanceId in its payload arg.
      await service.broadcastPostEvent(event);
      const publishedPayload = redis.publish.mock.calls[0][1];

      // Simulate redis echoing this instance's own published event back to the subscriber.
      postChannelCb(publishedPayload);

      // Must still be exactly the one delivery from broadcastPostEvent — the echoed
      // self-tagged payload must NOT be forwarded a second time.
      expect(received).toEqual([{ data: event }]);
    });
  });

  describe('onModuleDestroy', () => {
    it('calls each unsubscribe fn returned by redis.subscribe', () => {
      const unsubPost = jest.fn();
      const unsubFeed = jest.fn();
      const redis = makeRedisMock();
      redis.subscribe = jest
        .fn<Unsubscribe, [string, SubscribeHandler]>()
        .mockReturnValueOnce(unsubPost)
        .mockReturnValueOnce(unsubFeed);
      const service = newService(redis);
      service.onModuleInit();

      expect(() => service.onModuleDestroy()).not.toThrow();

      expect(unsubPost).toHaveBeenCalledTimes(1);
      expect(unsubFeed).toHaveBeenCalledTimes(1);
    });

    it('completes both subjects so a post-destroy broadcast no longer reaches a new subscriber', async () => {
      const redis = makeRedisMock();
      const service = newService(redis);
      service.onModuleInit();
      service.onModuleDestroy();

      const received: unknown[] = [];
      service.getPostStream('p1').subscribe((msg) => received.push(msg));

      await expect(
        service.broadcastPostEvent({ type: 'post_deleted', postId: 'p1' }),
      ).resolves.toBeUndefined();

      expect(received).toHaveLength(0);
    });
  });
});
