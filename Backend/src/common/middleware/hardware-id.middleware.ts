import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// T4-STANDARD Pillar 5: Zero-Trust Asset Protection
// Only enforce HWID on routes that serve protected content.
// Auth, forum, wallet, and user endpoints are guarded by AuthGuard instead.
const HWID_REQUIRED: RegExp[] = [
  /^\/books\/chapters\/[^/]+\/pages/,
  /^\/books\/chapters\/[^/]+\/[^/]+-translate/,
  /^\/books\/translate\/mit-health/,
  /^\/versions\/[^/]+(\/|$)/,
  /^\/upload\//,
];

@Injectable()
export class HardwareIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ZeroTrust');

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;

    if (!HWID_REQUIRED.some((pattern) => pattern.test(path))) {
      return next();
    }

    const hwId = req.headers['x-hardware-id'];

    if (!hwId) {
      this.logger.warn(`HWID missing — ${req.method} ${path}`);
      res.status(401).json({ statusCode: 401, message: 'Missing hardware ID' });
      return;
    }

    (req as any).hardwareId = hwId;
    this.logger.debug(`HWID verified: ${String(hwId).slice(0, 8)}... — ${req.method} ${path}`);
    next();
  }
}
