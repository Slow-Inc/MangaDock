import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { RedisService } from '../cache/redis.service';

const REDIS_WALLET_CHANNEL = 'wallet:events';

@Injectable()
export class WalletEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletEventsService.name);
  private readonly subjects = new Map<string, Subject<{ balance: number }>>();
  private unsubscribe: (() => void) | null = null;
  // Tag events published by this instance so the Redis subscriber can skip our
  // own echoes — the local fan-out already happened in emit() before publish().
  private readonly instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  constructor(private readonly redis: RedisService) {}

  onModuleInit() {
    this.unsubscribe = this.redis.subscribe(
      REDIS_WALLET_CHANNEL,
      (data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const rec = data as Record<string, unknown>;
        // Skip events we published — they were already delivered locally in emit().
        if (rec['_src'] === this.instanceId) return;
        const paymentId = rec['paymentId'];
        const balance = rec['balance'];
        if (typeof paymentId === 'string' && typeof balance === 'number') {
          // Relay a remote event into the local Subject ONLY — never re-publish,
          // or two instances would echo each other's events forever.
          this.emitLocal(paymentId, { balance });
        }
      },
    );
  }

  onModuleDestroy() {
    this.unsubscribe?.();
    this.subjects.forEach((s) => s.complete());
    this.subjects.clear();
  }

  private getOrCreate(paymentId: string): Subject<{ balance: number }> {
    let subject = this.subjects.get(paymentId);
    if (!subject) {
      subject = new Subject<{ balance: number }>();
      this.subjects.set(paymentId, subject);
    }
    return subject;
  }

  stream$(paymentId: string): Observable<{ balance: number }> {
    return new Observable<{ balance: number }>((subscriber) => {
      const subject = this.getOrCreate(paymentId);
      const inner = subject.subscribe(subscriber);
      // Teardown fires on client disconnect or QR-expiry timer (controller's
      // takeUntil). Once the last subscriber leaves, finalize the subject and
      // drop the Map entry so the registry can't grow unbounded as topups
      // expire without ever being paid (emit() only fires on success).
      return () => {
        inner.unsubscribe();
        if (subject.observers.length === 0) {
          subject.complete();
          this.subjects.delete(paymentId);
        }
      };
    });
  }

  /**
   * Deliver a wallet event to local SSE subscribers AND relay it over Redis so
   * subscribers connected to other backend instances receive it too. Local
   * delivery happens first and unconditionally (Redis may be unavailable);
   * the Redis publish is best-effort.
   */
  emit(paymentId: string, data: { balance: number }): void {
    this.emitLocal(paymentId, data);
    if (this.redis.available) {
      this.redis
        .publish(REDIS_WALLET_CHANNEL, {
          paymentId,
          ...data,
          _src: this.instanceId,
        })
        .catch((err) =>
          this.logger.warn(
            `Redis publish failed for wallet event: ${String(err)}`,
          ),
        );
    }
  }

  /** Fan out to the local per-topup Subject only (no Redis). Loop-safe: this is
   *  the single path both local emit() and remote Redis relays flow through. */
  private emitLocal(paymentId: string, data: { balance: number }): void {
    const sub = this.subjects.get(paymentId);
    if (!sub) return;
    sub.next(data);
    sub.complete();
    this.subjects.delete(paymentId);
  }
}
