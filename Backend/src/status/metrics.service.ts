import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { RedisService } from '../cache/redis.service';

const HEARTBEAT_INTERVAL_MS = 10_000;
const METRICS_TTL_SEC = 30;

export interface NodeMetrics {
  nodeId: string;
  cpu: number;      // 0–1 ratio
  freeMem: number;  // bytes
  latency: number;  // ms to Supabase
  timestamp: number;
}

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  readonly nodeId = `node-${process.pid}-${randomUUID()}`;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private publishing = false;

  constructor(private readonly redis: RedisService) {}

  onModuleInit() {
    this.publishMetrics().catch(err => this.logger.warn(`Heartbeat failed: ${String(err)}`));
    this.heartbeatTimer = setInterval(
      () => this.publishMetrics().catch(err => this.logger.warn(`Heartbeat failed: ${String(err)}`)),
      HEARTBEAT_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  async publishMetrics(): Promise<void> {
    if (this.publishing) {
      this.logger.debug('publishMetrics skipped — previous publish still in flight');
      return;
    }
    this.publishing = true;
    try {
      const metrics = await this.gatherMetrics();
      await this.redis.set(
        `cluster_metrics:${this.nodeId}`,
        JSON.stringify(metrics),
        METRICS_TTL_SEC,
      );
      this.logger.debug(
        `Heartbeat cpu=${(metrics.cpu * 100).toFixed(1)}% freeMem=${(metrics.freeMem / 1e9).toFixed(2)}GB lat=${metrics.latency}ms`,
      );
    } finally {
      this.publishing = false;
    }
  }

  async gatherMetrics(): Promise<NodeMetrics> {
    const [cpu, latency] = await Promise.all([this.sampleCpuLoad(), this.pingSupabase()]);
    return { nodeId: this.nodeId, cpu, freeMem: os.freemem(), latency, timestamp: Date.now() };
  }

  private sampleCpuLoad(): Promise<number> {
    return new Promise(resolve => {
      const before = os.cpus().map(c => c.times);
      setTimeout(() => {
        const after = os.cpus().map(c => c.times);
        const loads = before.map((b, i) => {
          const a = after[i];
          const idle = a.idle - b.idle;
          const total =
            Object.values(a).reduce((s, v) => s + v, 0) -
            Object.values(b).reduce((s, v) => s + v, 0);
          return total === 0 ? 0 : 1 - idle / total;
        });
        resolve(loads.reduce((s, v) => s + v, 0) / loads.length);
      }, 500);
    });
  }

  private async pingSupabase(): Promise<number> {
    const url = process.env.SUPABASE_URL;
    if (!url) return 0;
    const t0 = Date.now();
    try {
      await fetch(`${url}/rest/v1/`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
        headers: { apikey: process.env.SUPABASE_ANON_KEY ?? '' },
      });
    } catch { /* timeout counts as elapsed time */ }
    return Date.now() - t0;
  }
}
