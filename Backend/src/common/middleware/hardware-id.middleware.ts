import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HardwareIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ZeroTrust');

  use(req: Request, res: Response, next: NextFunction) {
    const hwId = req.headers['x-hardware-id'];

    if (hwId) {
      // T4-STANDARD Pillar 5: Zero-Trust Asset Protection (Stub)
      // Attach the hardware ID to the request object for later use in controllers/guards
      (req as any).hardwareId = hwId;
      
      // Optionally log for observability
      this.logger.debug(`Request from HWID: ${hwId} - ${req.method} ${req.url}`);
    }

    next();
  }
}
