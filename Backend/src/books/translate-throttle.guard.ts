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
 * Per client, keyed on `cf-connecting-ip` — set by Cloudflare in front of the app and not forgeable by
 * the client — else the socket address. X-Forwarded-For is NOT used: the Next proxy passes a
 * client-sent one through unchanged. The per-client check runs first, so rejected requests do not
 * consume the global ceiling. Fails OPEN when Redis is down, like TopupThrottleGuard (best-effort).
 */
@Injectable()
export class TranslateThrottleGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
    }>();
    const cf = req.headers['cf-connecting-ip'];
    const client =
      (Array.isArray(cf) ? cf[0] : cf)?.trim() || req.ip || 'unknown';

    const mine = await this.redis.incrWithTtl(
      `translate:desc:rl:${client}`,
      WINDOW_SEC,
    );
    if (mine === 0) return true; // Redis unavailable → fail open
    if (mine > PER_CLIENT_MAX) throw tooMany();

    const all = await this.redis.incrWithTtl(
      'translate:desc:rl:all',
      WINDOW_SEC,
    );
    if (all > GLOBAL_MAX) throw tooMany();
    return true;
  }
}

function tooMany(): HttpException {
  return new HttpException(
    'Too many translation requests. Please wait a minute.',
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
