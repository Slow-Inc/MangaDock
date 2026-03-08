import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

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

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => this.client?.disconnect());
      this.logger.log('Redis connection closed gracefully');
    }
  }
}
