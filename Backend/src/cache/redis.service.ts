import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private isConnected = false;
  private readonly subscriptions = new Map<string, Set<(data: unknown) => void>>();

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

  async keys(pattern: string): Promise<string[]> {
    if (!this.available) return [];
    try {
      return await this.client!.keys(pattern);
    } catch {
      return [];
    }
  }

  async getClient(): Promise<Redis | null> {
    return this.client;
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

  async publish(channel: string, data: unknown): Promise<void> {
    if (!this.available) return;
    try {
      await this.client!.publish(channel, JSON.stringify(data));
    } catch (err) {
      this.logger.warn(`Redis publish failed on "${channel}": ${String(err)}`);
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
