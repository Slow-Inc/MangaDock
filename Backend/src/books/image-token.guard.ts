import * as crypto from 'crypto';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

const SECRET = process.env.IMAGE_TOKEN_SECRET;

@Injectable()
export class ImageTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.headers['sec-fetch-mode'] === 'navigate') return false;
    if (!SECRET) return true;
    const token = req.query['t'] as string | undefined;
    const chapterId = req.query['cid'] as string | undefined;
    if (!token || !chapterId) return false;
    const firstDot = token.indexOf('.');
    if (firstDot < 0) return false;
    const lastDot = token.lastIndexOf('.');
    if (firstDot === lastDot) return false;
    const expiresAt = parseInt(token.slice(0, firstDot), 10);
    if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt)
      return false;
    const hwidEncoded = token.slice(firstDot + 1, lastDot);
    const hmac = token.slice(lastDot + 1);
    let h: string;
    try {
      h = Buffer.from(hwidEncoded, 'base64url').toString();
      if (!h) return false;
    } catch {
      return false;
    }
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${chapterId}:${expiresAt}:${h}`)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hmac, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
