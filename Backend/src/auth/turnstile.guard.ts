import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

// Helper to generate a time-limited clearance token
export function generateClearanceToken(secret: string): string {
  // Valid for 24 hours to prevent interrupting long reading sessions
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const data = expiresAt.toString();
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}.${hmac}`;
}

// Helper to verify the clearance token
export function verifyClearanceToken(token: string, secret: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [data, signature] = token.split('.');
  
  if (parseInt(data, 10) < Date.now()) {
    return false; // Expired
  }
  
  const expectedHmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac));
  } catch (e) {
    return false;
  }
}

@Injectable()
export class TurnstileGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Allow bypassing if explicitly disabled
    if (process.env.TURNSTILE_ENABLED === 'false') {
      return true;
    }

    const clearanceToken = request.headers['x-captcha-clearance'];
    if (!clearanceToken) {
      throw new UnauthorizedException('Captcha clearance token is missing.');
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

    if (verifyClearanceToken(clearanceToken, secretKey)) {
      return true;
    }

    throw new UnauthorizedException('Captcha clearance token is invalid or expired.');
}

}

