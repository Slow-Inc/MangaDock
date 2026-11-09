import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../cache/redis.service';
import { expoPush, pushResult } from './expo-push';

type Delivery = {
  id: string;
  uid: string;
  token: string;
  link: string;
  notification_id: string;
  phase: 'send' | 'receipt';
  ticket_id: string | null;
};
const QUEUE = 'notifications:phase5:ready';

@Injectable()
export class PushWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private running: Promise<void> = Promise.resolve();
  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    if (process.env.PUSH_DELIVERY_ENABLED !== 'true') return;
    this.stopped = false;
    this.schedule();
  }
  private schedule() {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.tick()
        .catch(() =>
          this.logger.warn(
            'Push delivery cycle failed; durable outbox retained',
          ),
        )
        .finally(() => this.schedule());
    }, 5000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }

  private async rpc<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await this.supabase.client
      .rpc(name, args)
      .returns<T>();
    if (error) throw new Error('Supabase push operation failed');
    return data as T;
  }

  async tick() {
    // Redis is a dedicated dispatch queue. PostgreSQL is durable authority and
    // reconstructs due IDs after Redis loss or a crash between pop and claim.
    const redis = await this.redis.getClient();
    if (!redis) return;
    const ids = await this.rpc<string[]>('phase5_push_due', {});
    if (ids.length)
      await redis.zadd(QUEUE, 'NX', ...ids.flatMap((id) => [Date.now(), id]));
    for (let i = 0; i < 10; i++) {
      const next = await redis.zpopmin(QUEUE);
      if (!next.length) break;
      const id = next[0];
      const lease = randomUUID();
      const delivery = await this.rpc<Delivery | null>('phase5_push_claim', {
        p_id: id,
        p_lease: lease,
      });
      if (!delivery) continue;
      let outcome = 'retry';
      let ticket: string | null = null;
      try {
        if (delivery.phase === 'send') {
          const response = (await expoPush('send', {
            to: delivery.token,
            channelId: 'mangadock-updates',
            title: 'MangaDock',
            body: 'มีความเคลื่อนไหวใหม่',
            sound: 'default',
            ttl: 3600,
            data: {
              version: '1',
              recipientUid: delivery.uid,
              notificationId: delivery.notification_id,
              link: delivery.link,
            },
          })) as { data?: unknown };
          const result = pushResult(response?.data);
          if (
            result?.status === 'ok' &&
            typeof result.id === 'string' &&
            result.id
          ) {
            outcome = 'ticket';
            ticket = result.id;
          } else if (result?.status === 'error')
            outcome =
              result.details?.error === 'DeviceNotRegistered'
                ? 'invalid'
                : result.details?.error === 'MessageRateExceeded'
                  ? 'retry'
                  : 'dead';
        } else {
          const response = (await expoPush('getReceipts', {
            ids: [delivery.ticket_id],
          })) as { data?: Record<string, unknown> };
          const result = pushResult(response?.data?.[delivery.ticket_id!]);
          if (result?.status === 'ok') outcome = 'delivered';
          else if (result?.status === 'error')
            outcome =
              result.details?.error === 'DeviceNotRegistered'
                ? 'invalid'
                : 'dead';
        }
      } catch {
        /* Persist a bounded retry; never log tokens or payloads. */
      }
      const state = await this.rpc<string>('phase5_push_finish', {
        p_id: id,
        p_lease: lease,
        p_outcome: outcome,
        p_ticket: ticket,
      });
      if (state === 'dead') {
        await redis.lpush('notifications:phase5:dead', id);
        await redis.ltrim('notifications:phase5:dead', 0, 999);
        this.logger.warn(
          'Push delivery exhausted or rejected; recorded in dead-letter outbox',
        );
      }
    }
  }
}
