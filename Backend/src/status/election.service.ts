import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { MetricsService } from './metrics.service';

const ELECTION_INTERVAL_MS = 15_000;
const LEADER_TTL_MS = Math.floor(ELECTION_INTERVAL_MS * 2.5); // 37.5s — survives one missed renewal
const LEADER_KEY = 'cache:leader';

@Injectable()
export class ElectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ElectionService.name);
  private electionTimer: NodeJS.Timeout | null = null;
  private _isLeader = false;

  constructor(
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  get isLeader(): boolean {
    return this._isLeader;
  }

  onModuleInit() {
    this.electionTimer = setInterval(
      () => this.runElection().catch(err => this.logger.warn(`Election error: ${String(err)}`)),
      ELECTION_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.electionTimer) clearInterval(this.electionTimer);
  }

  async runElection(): Promise<void> {
    const client = await this.redis.getClient();
    if (!client) return;

    const wasLeader = this._isLeader;
    const nodeId = this.metrics.nodeId;

    if (this._isLeader) {
      // Renewal: SET XX (only update if key still exists and owned by us)
      const renewed = await (client as any).set(
        LEADER_KEY, nodeId, 'XX', 'PX', LEADER_TTL_MS,
      ) as string | null;
      this._isLeader = renewed === 'OK';
    } else {
      // Acquisition: SET NX (only set if key does not exist)
      const acquired = await (client as any).set(
        LEADER_KEY, nodeId, 'NX', 'PX', LEADER_TTL_MS,
      ) as string | null;
      this._isLeader = acquired === 'OK';
    }

    if (this._isLeader !== wasLeader) {
      this.logger.log(`Leadership ${this._isLeader ? 'acquired' : 'lost'} (nodeId=${nodeId})`);
    }
  }
}
