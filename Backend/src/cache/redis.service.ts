import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

// Atomic INCR + first-hit EXPIRE in one round-trip (same named-Lua pattern as
// ElectionService / StatsIncrementService). Sets the TTL only when the key is
// newly created (n == 1), leaving it untouched on later hits so the window can't
// slide. Closes the incr-then-expire race that could leave an immortal key with
// no TTL (counter never resets → user throttled forever).
const INCR_EXPIRE_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n
`;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private isConnected = false;
  private readonly subscriptions = new Map<string, Set<(data: unknown) => void>>();
  private readonly reconnectCallbacks = new Set<() => void>();

  onReconnect(cb: () => void): () => void {
    this.reconnectCallbacks.add(cb);
    return () => this.reconnectCallbacks.delete(cb);
  }

  onModuleInit() {
    this.connect();
  }

  private connect() {
    const host = process.env.REDIS_HOST ?? 'localhost';
    const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);

    this.logger.log(`Connecting to Redis at ${host}:${port}`);

    this.client = new Redis({
      host,
      port,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times >= 3) {
          this.logger.warn('Redis unavailable — falling back to JSON cache only');
          this.isConnected = false;
          return null;
        }
        return Math.min(times * 500, 2000);
      },
      maxRetriesPerRequest: 1,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Redis connected');
      this.reconnectCallbacks.forEach(cb => {
        try { cb(); } catch (err) {
          this.logger.warn(`onReconnect callback error: ${String(err)}`);
        }
      });
    });

    this.client.on('error', (err: Error) => {
      this.isConnected = false;
      this.logger.warn(`Redis error: ${err.message}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    this.client.connect().catch(() => {
      this.logger.warn('Redis initial connection failed — will use JSON cache');
    });
  }

  get available(): boolean {
    return this.isConnected && this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.available) return null;
    try {
      return await this.client!.get(key);
    } catch {
      this.isConnected = false;
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.available) return;
    try {
      await this.client!.set(key, value, 'EX', ttlSeconds);
    } catch {
      this.isConnected = false;
    }
  }

  /** One round-trip for many keys; null per missing key (MGET semantics). */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    if (!this.available) return keys.map(() => null);
    try {
      return await this.client!.mget(...keys);
    } catch {
      this.isConnected = false;
      return keys.map(() => null);
    }
  }

  /**
   * Collects all keys matching `pattern` via a non-blocking SCAN cursor loop.
   * Unlike KEYS (O(N), blocks the Redis event loop over the whole keyspace),
   * SCAN iterates in bounded batches. Deduplicates because SCAN may return the
   * same key across iterations.
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.available) return [];
    try {
      const found = new Set<string>();
      let cursor = '0';
      do {
        const [next, batch] = await this.client!.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        for (const key of batch) found.add(key);
      } while (cursor !== '0');
      return [...found];
    } catch {
      return [];
    }
  }

  async getClient(): Promise<Redis | null> {
    return this.available ? this.client : null;
  }

  async incr(key: string): Promise<number> {
    if (!this.available) return 0;
    try {
      return await this.client!.incr(key);
    } catch {
      this.isConnected = false;
      return 0;
    }
  }

  /**
   * Atomic increment with a guaranteed TTL on the first hit (one round-trip via
   * Lua). Returns the post-increment count, or 0 when Redis is unavailable
   * (fail-open, matching incr()). Use for rate-limit counters where a separate
   * incr()+expire() would risk an immortal key if the process died between them.
   */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    if (!this.available) return 0;
    try {
      return (await (this.client as any).eval(INCR_EXPIRE_SCRIPT, 1, key, String(ttlSeconds))) as number;
    } catch {
      this.isConnected = false;
      return 0;
    }
  }

  async pfadd(key: string, ...members: string[]): Promise<number> {
    if (!this.available) return 0;
    try {
      return await (this.client as any).pfadd(key, ...members);
    } catch {
      return 0;
    }
  }

  async pfcount(key: string): Promise<number> {
    if (!this.available) return 0;
    try {
      return await (this.client as any).pfcount(key);
    } catch {
      return 0;
    }
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.available) return 0;
    try {
      return await (this.client as any).sadd(key, ...members);
    } catch {
      return 0;
    }
  }

  async llen(key: string): Promise<number> {
    if (!this.available) return 0;
    try {
      return await this.client!.llen(key);
    } catch {
      return 0;
    }
  }

  async scard(key: string): Promise<number> {
    if (!this.available) return 0;
    try {
      return await (this.client as any).scard(key);
    } catch {
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.available) return [];
    try {
      return await (this.client as any).smembers(key);
    } catch {
      return [];
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.available) return;
    try {
      await this.client!.expire(key, ttlSeconds);
    } catch {
      // best-effort
    }
  }

  // ─── Pub/Sub ──────────────────────────────────────────────────────────────────

  private ensureSubscriber(): Redis | null {
    if (!this.available || !this.client) return null;
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      this.subscriber.on('message', (channel: string, message: string) => {
        let data: unknown;
        try {
          data = JSON.parse(message);
        } catch (err) {
          this.logger.warn(`Redis message parse failed on "${channel}": ${String(err)}`);
          return;
        }
        this.subscriptions.get(channel)?.forEach(h => {
          try { h(data); } catch (err) {
            this.logger.warn(`Redis subscriber handler error on "${channel}": ${String(err)}`);
          }
        });
      });
      this.subscriber.on('error', (err: Error) => {
        this.logger.warn(`Redis subscriber error: ${err.message}`);
      });
    }
    return this.subscriber;
  }

  async publish(channel: string, data: unknown): Promise<boolean> {
    if (!this.available) return false;
    try {
      await this.client!.publish(channel, JSON.stringify(data));
      return true;
    } catch (err) {
      this.logger.warn(`Redis publish failed on "${channel}": ${String(err)}`);
      return false;
    }
  }

  subscribe(channel: string, handler: (data: unknown) => void): () => void {
    const sub = this.ensureSubscriber();
    if (!sub) return () => {};

    const existing = this.subscriptions.get(channel);
    if (existing) {
      existing.add(handler);
    } else {
      this.subscriptions.set(channel, new Set([handler]));
      sub.subscribe(channel).catch(err =>
        this.logger.warn(`Redis SUBSCRIBE "${channel}" failed: ${String(err)}`),
      );
    }

    return () => {
      const handlers = this.subscriptions.get(channel);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(channel);
        sub.unsubscribe(channel).catch(() => {});
      }
    };
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => this.subscriber?.disconnect());
    }
    if (this.client) {
      await this.client.quit().catch(() => this.client?.disconnect());
      this.logger.log('Redis connection closed gracefully');
    }
  }
}
