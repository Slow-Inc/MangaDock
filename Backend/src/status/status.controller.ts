import { Controller, Get, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StatusService, SystemStatusEvent } from './status.service';
import { CacheHealthService } from '../cache/cache-health.service';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('status')
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly cacheHealth: CacheHealthService,
  ) {}

  @Sse('stream')
  sse(): Observable<MessageEvent> {
    return this.statusService.getStatusStream().pipe(
      map((event: SystemStatusEvent) => ({
        data: event,
      }))
    );
  }

  @Get('cache')
  getCacheHealth() {
    return this.cacheHealth.getHealth();
  }
}
