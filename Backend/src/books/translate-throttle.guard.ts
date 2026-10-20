import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisService } from '../cache/redis.service';

const PER_CLIENT_MAX = 30; // description translations per client per minute
const GLOBAL_MAX = 600; // all clients together per minute — the spend ceiling
const WINDOW_SEC = 60;

/**
 * Rate limit for the public GET /books/translate (#801), which can spend a paid provider key.
 * Per client (first X-Forwarded-For address — the browser behind the Next proxy — else the socket),
 * plus a global ceiling, because a forwarded address is client-supplied and rotating it must not
 * lift the total. Fails OPEN when Redis is down, like TopupThrottleGuard: protection is best-effort.
 */
@Injectable()
export class TranslateThrottleGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
    }>();
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',')[0]
      ?.trim();
    const client = first || req.ip || 'unknown';

    const all = await this.redis.incrWithTtl(
      'translate:desc:rl:all',
      WINDOW_SEC,
    );
    const mine = await this.redis.incrWithTtl(
      `translate:desc:rl:${client}`,
      WINDOW_SEC,
    );
    if (all > GLOBAL_MAX || mine > PER_CLIENT_MAX) {
      throw new HttpException(
        'Too many translation requests. Please wait a minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true; // a 0 count means Redis is unavailable → fail open
  }
}
