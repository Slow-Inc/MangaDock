import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { register } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}
