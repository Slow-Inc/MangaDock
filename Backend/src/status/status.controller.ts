import { Controller, Get, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StatusService, SystemStatusEvent } from './status.service';
import { CacheHealthService } from '../cache/cache-health.service';
import { AuthGuard } from '../auth/auth.guard';

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

  @UseGuards(AuthGuard)
  @Get('cache')
  getCacheHealth() {
    return this.cacheHealth.getHealth();
  }
}
