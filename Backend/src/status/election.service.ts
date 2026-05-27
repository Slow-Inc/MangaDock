import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { MetricsService } from './metrics.service';

const ELECTION_INTERVAL_MS = 15_000;
const LEADER_TTL_MS = Math.floor(ELECTION_INTERVAL_MS * 2.5); // 37.5s — survives one missed renewal
const LEADER_KEY = 'cache:leader';

// Atomic compare-and-swap: renew only if we still own the lock.
// Prevents split-brain when a node reconnects after its lock expired and another node has taken over.
const RENEW_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[2])
  else
    return nil
  end
`;

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
    this.runElection().catch(err => this.logger.warn(`Initial election error: ${String(err)}`));
    this.electionTimer = setInterval(
      () => this.runElection().catch(err => this.logger.warn(`Election error: ${String(err)}`)),
      ELECTION_INTERVAL_MS,
    );
  }

  async onModuleDestroy() {
    if (this.electionTimer) clearInterval(this.electionTimer);
    if (!this._isLeader) return;
    const client = await this.redis.getClient();
    if (!client) return;
    try {
      await (client as any).del(LEADER_KEY);
      this.logger.log('Leader lock released on shutdown');
    } catch (err) {
      this.logger.warn(`Failed to release leader lock: ${String(err)}`);
    }
  }

  async runElection(): Promise<void> {
    const client = await this.redis.getClient();
    if (!client) return;

    const wasLeader = this._isLeader;
    const nodeId = this.metrics.nodeId;

    if (this._isLeader) {
      // Renewal: Lua CAS — only renew if we still hold the lock value
      const renewed = await (client as any).eval(
        RENEW_SCRIPT, 1, LEADER_KEY, nodeId, String(LEADER_TTL_MS),
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
