import { WalletEventsService } from './wallet-events.service';
import type { RedisService } from '../cache/redis.service';

/**
 * In-memory stand-in for RedisService's pub/sub surface. A single bus instance
 * shared between two WalletEventsService instances simulates two backend
 * processes wired to the same Redis, so cross-instance delivery can be asserted
 * without a real Redis. publish() serializes/deserializes to mirror the real
 * JSON round-trip and fans out to every subscribed handler synchronously.
 */
class FakeRedisBus {
  available = true;
  publishCalls: Array<{ channel: string; data: unknown }> = [];
  private readonly handlers = new Map<string, Set<(d: unknown) => void>>();

  publish = jest.fn((channel: string, data: unknown): Promise<boolean> => {
    this.publishCalls.push({ channel, data });
    const clone = JSON.parse(JSON.stringify(data));
    this.handlers.get(channel)?.forEach((h) => h(clone));
    return Promise.resolve(true);
  });

  subscribe = jest.fn(
    (channel: string, handler: (d: unknown) => void): (() => void) => {
      let set = this.handlers.get(channel);
      if (!set) {
        set = new Set();
        this.handlers.set(channel, set);
      }
      set.add(handler);
      return () => set.delete(handler);
    },
  );
}

/** Redis stub that is present but reports unavailable — exercises local-only path. */
const offlineRedis = (): RedisService =>
  ({
    available: false,
    publish: jest.fn(),
    subscribe: jest.fn(() => () => {}),
  }) as unknown as RedisService;

describe('WalletEventsService', () => {
  let service: WalletEventsService;

  beforeEach(() => {
    service = new WalletEventsService(offlineRedis());
  });

  it('stream$ emits value and completes when emit() is called', (done) => {
    const values: { balance: number }[] = [];
    service.stream$('pay-123').subscribe({
      next: (v) => values.push(v),
      complete: () => {
        expect(values).toEqual([{ balance: 500 }]);
        done();
      },
    });
    service.emit('pay-123', { balance: 500 });
  });

  it('emit on unknown paymentId does nothing', () => {
    expect(() => service.emit('unknown', { balance: 0 })).not.toThrow();
  });

  it('internal subject is cleaned up after emit — second emit is a no-op', () => {
    service.stream$('pay-789').subscribe();
    service.emit('pay-789', { balance: 100 });
    expect(() => service.emit('pay-789', { balance: 200 })).not.toThrow();
  });

  it('removes the subject from the registry when the stream is torn down (client disconnect / QR expiry)', () => {
    const sub = service.stream$('pay-teardown').subscribe();
    expect(service['subjects'].has('pay-teardown')).toBe(true);
    sub.unsubscribe();
    expect(service['subjects'].has('pay-teardown')).toBe(false);
  });

  it('keeps the subject while another subscriber is still connected', () => {
    const a = service.stream$('pay-multi').subscribe();
    const b = service.stream$('pay-multi').subscribe();
    a.unsubscribe();
    expect(service['subjects'].has('pay-multi')).toBe(true);
    b.unsubscribe();
    expect(service['subjects'].has('pay-multi')).toBe(false);
  });

  it('does not grow the registry unbounded as topups tear down over time', () => {
    for (let i = 0; i < 50; i++) {
      service.stream$(`pay-${i}`).subscribe().unsubscribe();
    }
    expect(service['subjects'].size).toBe(0);
  });

  describe('cross-instance delivery via Redis pub/sub (FR-13)', () => {
    let bus: FakeRedisBus;
    let instA: WalletEventsService;
    let instB: WalletEventsService;

    beforeEach(() => {
      bus = new FakeRedisBus();
      instA = new WalletEventsService(bus as unknown as RedisService);
      instB = new WalletEventsService(bus as unknown as RedisService);
      instA.onModuleInit();
      instB.onModuleInit();
    });

    afterEach(() => {
      instA.onModuleDestroy();
      instB.onModuleDestroy();
    });

    it('delivers an event published on instance A to a subscriber on instance B', (done) => {
      const seen: { balance: number }[] = [];
      instB.stream$('pay-cross').subscribe({
        next: (v) => seen.push(v),
        complete: () => {
          expect(seen).toEqual([{ balance: 999 }]);
          done();
        },
      });

      // Event originates on instance A (no local subscriber there).
      instA.emit('pay-cross', { balance: 999 });
    });

    it('publishes to a shared wallet channel with the balance payload', () => {
      instA.emit('pay-chan', { balance: 42 });
      expect(bus.publishCalls).toHaveLength(1);
      const { channel, data } = bus.publishCalls[0];
      expect(channel).toBe('wallet:events');
      expect(data).toMatchObject({ paymentId: 'pay-chan', balance: 42 });
    });

    it('does NOT re-publish an event it received from Redis (no publish loop)', () => {
      instB.stream$('pay-loop').subscribe();
      instA.emit('pay-loop', { balance: 7 });
      // Exactly one publish total: instance A's. Instance B relays into its
      // local subject only — it must not echo back onto the channel.
      expect(bus.publish).toHaveBeenCalledTimes(1);
    });

    it('delivers to a local subscriber exactly once (no self double-delivery)', () => {
      const seen: { balance: number }[] = [];
      instA.stream$('pay-self').subscribe((v) => seen.push(v));
      instA.emit('pay-self', { balance: 5 });
      expect(seen).toEqual([{ balance: 5 }]);
    });

    it('still delivers locally when Redis is unavailable', (done) => {
      const local = new WalletEventsService(offlineRedis());
      local.onModuleInit();
      local.stream$('pay-offline').subscribe({
        next: (v) => expect(v).toEqual({ balance: 3 }),
        complete: () => {
          local.onModuleDestroy();
          done();
        },
      });
      local.emit('pay-offline', { balance: 3 });
    });
  });
});
