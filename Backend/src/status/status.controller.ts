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

type ServiceStatus = 'up' | 'degraded' | 'down';
interface StatusCheck { id: string; status: ServiceStatus; latencyMs: number | null; detail?: string }
interface StatusSnapshot {
  schemaVersion: 1;
  service: string;
  status: ServiceStatus;
  reason: string;
  checks: StatusCheck[];
  uptimeSec: number;
  durationMs: number;
  checkedAt: string;
}

@Controller('status')
export class StatusController {
  constructor(
    private readonly statusService: StatusService,
    private readonly cacheHealth: CacheHealthService,
  ) {}

  @Get()
  async getStatus(): Promise<StatusSnapshot> {
    const t0 = Date.now();
    const checks: StatusCheck[] = [];
    let worst: ServiceStatus = 'up';

    const rt0 = Date.now();
    try {
      await this.cacheHealth.getHealth();
      const ms = Date.now() - rt0;
      const s: ServiceStatus = ms > 200 ? 'degraded' : 'up';
      checks.push({
        id: 'redis',
        status: s,
        latencyMs: ms,
        ...(s !== 'up' ? { detail: `latency ${ms}ms > 200ms threshold` } : {}),
      });
      if (s === 'degraded' && worst === 'up') worst = 'degraded';
    } catch {
      checks.push({ id: 'redis', status: 'down', latencyMs: null, detail: 'redis unreachable' });
      worst = 'down';
    }

    const reason =
      worst === 'up'
        ? 'all checks passed'
        : checks.find((c) => c.status !== 'up')?.detail ?? 'check failed';

    return {
      schemaVersion: 1,
      service: 'backend',
      status: worst,
      reason,
      checks,
      uptimeSec: Math.floor(process.uptime()),
      durationMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
    };
  }

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
