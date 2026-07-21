import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { resolveTurnstileConfig } from './turnstile.config';

// Helper to generate a time-limited clearance token bound to a hardware ID
export function generateClearanceToken(secret: string, hwid: string): string {
  // Valid for 1 hour as per Phase 1.5 roadmap
  const expiresAt = Date.now() + 1 * 60 * 60 * 1000;
  const data = `${expiresAt}:${hwid}`;
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}.${hmac}`;
}

// Helper to verify the clearance token against a specific hardware ID
export function verifyClearanceToken(
  token: string,
  secret: string,
  currentHwid: string,
): boolean {
  if (!token || !token.includes('.')) return false;
  const [data, signature] = token.split('.');

  const [expiresAtStr, tokenHwid] = data.split(':');

  // 1. Check expiration
  if (parseInt(expiresAtStr, 10) < Date.now()) {
    return false;
  }

  // 2. Check hardware ID binding (Zero-Trust)
  if (tokenHwid !== currentHwid) {
    return false;
  }

  // 3. Verify HMAC signature
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedHmac),
    );
  } catch (e) {
    return false;
  }
}

@Injectable()
export class TurnstileGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentHwid = request.headers['x-hardware-id'] as string;

    // Fail-closed config: in production a missing/test secret has already
    // crashed the app at boot, so `secret` here is always real (#224).
    const { enabled, secret } = resolveTurnstileConfig(process.env);

    // Allow bypassing only when disabled outside production.
    if (!enabled) {
      return true;
    }

    if (!currentHwid) {
      throw new UnauthorizedException('Hardware ID is missing.');
    }

    const clearanceToken = request.headers['x-captcha-clearance'];
    if (!clearanceToken) {
      throw new UnauthorizedException('Captcha clearance token is missing.');
    }

    if (verifyClearanceToken(clearanceToken, secret, currentHwid)) {
      return true;
    }

    throw new UnauthorizedException(
      'Captcha clearance token is invalid, expired, or bound to another device.',
    );
  }
}
