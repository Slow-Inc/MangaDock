import { Injectable, NestMiddleware, Logger, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UsersService } from '../../users/users.service';

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

// X-Hardware-Id is a client-generated device fingerprint. The current generator
// (Frontend/app/lib/fingerprint.ts) emits `mdock_` + up to 32 base64 chars
// (~38 chars total); the existing test ids ("device-abc123") and UUIDs also fit.
// We bound the length generously (8–128) so a future FingerprintJS swap still
// fits, and restrict the charset to base64/url-safe id characters so malformed
// values — whitespace, control chars, injection payloads, duplicate-header
// arrays — are rejected up front instead of trusted as a device identity.
const HWID_PATTERN = /^[A-Za-z0-9_+/=-]{8,128}$/;

export function isValidHardwareId(value: unknown): value is string {
  return typeof value === 'string' && HWID_PATTERN.test(value);
}

/** Lightweight JWT payload decode to extract `sub` (uid) without verification.
 *  Used only for observational device tracking — NOT for access control. */
function extractUidFromBearer(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const parts = authHeader.slice(7).split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    return typeof payload['sub'] === 'string' ? payload['sub'] : null;
  } catch {
    return null;
  }
}

@Injectable()
export class HardwareIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ZeroTrust');

  constructor(
    // @Optional() so `new HardwareIdMiddleware()` in unit tests still works
    // (usersService = undefined → device tracking is skipped, HWID check still runs)
    @Optional() private readonly usersService?: UsersService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;

    if (!HWID_REQUIRED.some((pattern) => pattern.test(path))) {
      return next();
    }

    const hwId = req.headers['x-hardware-id'];

    if (!isValidHardwareId(hwId)) {
      this.logger.warn(`HWID missing or malformed — ${req.method} ${path}`);
      res
        .status(401)
        .json({ statusCode: 401, message: 'Missing or malformed hardware ID' });
      return;
    }

    (req as any).hardwareId = hwId;
    this.logger.debug(
      `HWID verified: ${String(hwId).slice(0, 8)}... — ${req.method} ${path}`,
    );

    // Fire-and-forget device tracking (does NOT block the request).
    // Only runs when UsersService is injected (production) and uid is present.
    if (this.usersService) {
      const uid = extractUidFromBearer(req.headers['authorization']);
      if (uid) {
        const userAgent = String(req.headers['user-agent'] ?? 'unknown');
        this.usersService
          .recordDeviceAndAlert(uid, hwId, userAgent)
          .catch((err: unknown) => {
            this.logger.warn(
              `[DeviceTracking] unhandled error: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }
    }

    next();
  }
}
