import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const t0 = Date.now();
    const { method } = req;

    res.on('finish', () => {
      // Normalise dynamic segments to reduce cardinality
      const route =
        (req.route?.path as string | undefined) ??
        req.path.replace(/\/[0-9a-f-]{8,}/g, '/:id').replace(/\/\d+/g, '/:id');
      const duration = Date.now() - t0;
      httpRequestsTotal.inc({
        service: 'backend',
        method,
        route,
        status_code: String(res.statusCode),
      });
      httpRequestDuration.observe(
        { service: 'backend', method, route },
        duration,
      );
    });

    next();
  }
}
