import { ElectionService } from './election.service';
import { MetricsService } from './metrics.service';
import { RedisService } from '../cache/redis.service';

function makeMetricsSvc(nodeId = 'node-1'): jest.Mocked<Pick<MetricsService, 'nodeId'>> {
  return { nodeId } as jest.Mocked<Pick<MetricsService, 'nodeId'>>;
}

interface RedisClientStub {
  set: jest.Mock;
  get: jest.Mock;
}

function makeElection(
  nodeId: string,
  clientStub: RedisClientStub,
): ElectionService {
  const redis = {
    getClient: jest.fn().mockResolvedValue(clientStub),
  } as unknown as RedisService;
  const metrics = makeMetricsSvc(nodeId) as unknown as MetricsService;
  return new ElectionService(redis, metrics);
}

function nxLockClient(winner: string | null): RedisClientStub {
  return {
    // SET NX returns 'OK' on success, null when key already exists
    set: jest.fn().mockResolvedValue(winner),
    get: jest.fn().mockResolvedValue(winner),
  };
}

describe('ElectionService — Redis NX Lock', () => {
  describe('lock acquisition', () => {
    it('becomes leader when SET NX succeeds (returns OK)', async () => {
      const client = nxLockClient('OK');
      const svc = makeElection('node-1', client);

      await svc.runElection();

      expect(svc.isLeader).toBe(true);
    });

    it('does not become leader when lock is already held (SET NX returns null)', async () => {
      const client = nxLockClient(null);
      const svc = makeElection('node-1', client);

      await svc.runElection();

      expect(svc.isLeader).toBe(false);
    });

    it('does not become leader when lock is held by a different node', async () => {
      const client: RedisClientStub = {
        set: jest.fn().mockResolvedValue(null),   // NX fails — key exists
        get: jest.fn().mockResolvedValue('node-other'),
      };
      const svc = makeElection('node-1', client);

      await svc.runElection();

      expect(svc.isLeader).toBe(false);
    });
  });

  describe('lock renewal', () => {
    it('retains leadership across multiple election cycles when renewal succeeds', async () => {
      const client: RedisClientStub = {
        set: jest.fn()
          .mockResolvedValueOnce('OK')   // first acquisition
          .mockResolvedValue('OK'),      // subsequent renewals (XX)
        get: jest.fn().mockResolvedValue('node-1'),
      };
      const svc = makeElection('node-1', client);

      await svc.runElection(); // acquires
      await svc.runElection(); // renews

      expect(svc.isLeader).toBe(true);
    });

    it('loses leadership when renewal fails (key expired or taken)', async () => {
      const client: RedisClientStub = {
        set: jest.fn()
          .mockResolvedValueOnce('OK')  // first acquisition
          .mockResolvedValue(null),     // renewal fails
        get: jest.fn().mockResolvedValue('node-other'),
      };
      const svc = makeElection('node-1', client);

      await svc.runElection(); // acquires
      expect(svc.isLeader).toBe(true);

      await svc.runElection(); // renewal fails
      expect(svc.isLeader).toBe(false);
    });
  });

  describe('leadership change logging', () => {
    it('logs when leadership is acquired', async () => {
      const client = nxLockClient('OK');
      const svc = makeElection('node-1', client);
      const logSpy = jest.spyOn((svc as any).logger, 'log');

      await svc.runElection();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('acquired'));
    });

    it('logs when leadership is lost', async () => {
      const client: RedisClientStub = {
        set: jest.fn()
          .mockResolvedValueOnce('OK')
          .mockResolvedValue(null),
        get: jest.fn().mockResolvedValue('node-other'),
      };
      const svc = makeElection('node-1', client);
      const logSpy = jest.spyOn((svc as any).logger, 'log');

      await svc.runElection(); // acquires
      await svc.runElection(); // loses

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('lost'));
    });
  });
});
