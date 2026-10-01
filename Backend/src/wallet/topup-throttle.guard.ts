import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { USER_KEY } from '../auth/auth.guard';

const TOPUP_RL_MAX = 5;
const TOPUP_RL_WINDOW_SEC = 60;

/**
 * Per-uid sliding-window-ish rate limiter for topup creation (each call hits the
 * live Xendit API). Fails OPEN when Redis is down (incr() returns 0) so a Redis
 * outage never blocks legitimate payment — abuse protection is best-effort.
 */
@Injectable()
export class TopupThrottleGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const uid = req?.[USER_KEY]?.uid;
    if (!uid) return true; // AuthGuard runs first; if no uid, let it handle auth

    const key = `topup:create:rl:${uid}`;
    // Atomic incr + first-hit TTL in one round-trip — no window where the key
    // exists without an expiry (which would throttle the user forever).
    const count = await this.redis.incrWithTtl(key, TOPUP_RL_WINDOW_SEC);
    if (count === 0) return true; // Redis unavailable → fail open
    if (count > TOPUP_RL_MAX) {
      throw new HttpException(
        'Too many topup requests. Please wait a minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
