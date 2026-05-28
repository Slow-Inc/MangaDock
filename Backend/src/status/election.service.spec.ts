import { ElectionService } from './election.service';
import { MetricsService } from './metrics.service';
import { RedisService } from '../cache/redis.service';

function makeMetricsSvc(nodeId = 'node-1'): jest.Mocked<Pick<MetricsService, 'nodeId'>> {
  return { nodeId } as jest.Mocked<Pick<MetricsService, 'nodeId'>>;
}

interface RedisClientStub {
  set: jest.Mock;   // NX acquisition
  eval: jest.Mock;  // Lua CAS renewal
  del: jest.Mock;   // lock release on destroy
  get: jest.Mock;
}

function makeClient(overrides: Partial<RedisClientStub> = {}): RedisClientStub {
  return {
    set: jest.fn().mockResolvedValue(null),
    eval: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeElection(nodeId: string, clientStub: RedisClientStub): ElectionService {
  const redis = {
    getClient: jest.fn().mockResolvedValue(clientStub),
  } as unknown as RedisService;
  const metrics = makeMetricsSvc(nodeId) as unknown as MetricsService;
  return new ElectionService(redis, metrics);
}

describe('ElectionService — Redis NX Lock', () => {
  describe('startup', () => {
    it('runs election immediately on onModuleInit — before any interval fires', async () => {
      jest.useFakeTimers();
      const client = makeClient({ set: jest.fn().mockResolvedValue('OK') });
      const svc = makeElection('node-1', client);

      svc.onModuleInit();
      await Promise.resolve(); // flush getClient microtask
      await Promise.resolve(); // flush SET NX microtask

      expect(client.set).toHaveBeenCalledTimes(1);
      expect(svc.isLeader).toBe(true);

      await svc.onModuleDestroy();
      jest.useRealTimers();
    });
  });

  describe('lock acquisition', () => {
    it('becomes leader when SET NX succeeds (returns OK)', async () => {
      const client = makeClient({ set: jest.fn().mockResolvedValue('OK') });
      const svc = makeElection('node-1', client);

      await svc.runElection();

      expect(svc.isLeader).toBe(true);
    });

    it('does not become leader when lock is already held (SET NX returns null)', async () => {
      const client = makeClient(); // set returns null by default
      const svc = makeElection('node-1', client);

      await svc.runElection();

      expect(svc.isLeader).toBe(false);
    });

    it('does not become leader when lock is held by a different node', async () => {
      const client = makeClient({ set: jest.fn().mockResolvedValue(null) });
      const svc = makeElection('node-1', client);

      await svc.runElection();

      expect(svc.isLeader).toBe(false);
    });
  });

  describe('lock renewal (Lua CAS)', () => {
    it('retains leadership across multiple election cycles when renewal succeeds', async () => {
      const client = makeClient({
        set: jest.fn().mockResolvedValue('OK'),   // NX acquisition
        eval: jest.fn().mockResolvedValue('OK'),  // Lua renewal
      });
      const svc = makeElection('node-1', client);

      await svc.runElection(); // acquires via SET NX
      await svc.runElection(); // renews via Lua eval

      expect(svc.isLeader).toBe(true);
      expect(client.eval).toHaveBeenCalledTimes(1);
    });

    it('uses Lua eval (not SET XX) for renewal — preventing ownership-blind overwrite', async () => {
      const client = makeClient({
        set: jest.fn().mockResolvedValue('OK'),
        eval: jest.fn().mockResolvedValue('OK'),
      });
      const svc = makeElection('node-1', client);

      await svc.runElection(); // acquire
      await svc.runElection(); // renew

      expect(client.eval).toHaveBeenCalledTimes(1);
      expect(client.set).toHaveBeenCalledTimes(1); // only NX, no XX
    });

    it('loses leadership when Lua CAS returns null (lock taken by another node)', async () => {
      const client = makeClient({
        set: jest.fn().mockResolvedValue('OK'),
        eval: jest.fn().mockResolvedValue(null), // CAS fails — lock stolen
      });
      const svc = makeElection('node-1', client);

      await svc.runElection(); // acquires
      expect(svc.isLeader).toBe(true);

      await svc.runElection(); // CAS fails
      expect(svc.isLeader).toBe(false);
    });

    it('loses leadership when renewal fails (key expired)', async () => {
      const client = makeClient({
        set: jest.fn().mockResolvedValue('OK'),
        eval: jest.fn().mockResolvedValue(null),
      });
      const svc = makeElection('node-1', client);

      await svc.runElection(); // acquires
      await svc.runElection(); // renewal fails

      expect(svc.isLeader).toBe(false);
    });
  });

  describe('lock release on shutdown (Lua CAS-delete)', () => {
    it('releases lock via Lua eval when leader — only deletes if value still matches nodeId', async () => {
      const client = makeClient({
        set: jest.fn().mockResolvedValue('OK'),
        eval: jest.fn().mockResolvedValue(1), // DELETE_SCRIPT returns 1 = deleted
      });
      const svc = makeElection('node-1', client);

      await svc.runElection(); // become leader via SET NX
      await svc.onModuleDestroy();

      expect(client.eval).toHaveBeenCalledWith(
        expect.stringContaining('DEL'),
        1,
        'cache:leader',
        'node-1',
      );
    });

    it('does not call eval for delete when not leader on onModuleDestroy', async () => {
      const client = makeClient(); // never becomes leader
      const svc = makeElection('node-1', client);

      await svc.runElection(); // fails to acquire
      await svc.onModuleDestroy();

      expect(client.eval).not.toHaveBeenCalled();
    });

    it('handles the case where lock was already taken by another node (eval returns 0) without throwing', async () => {
      const client = makeClient({
        set: jest.fn().mockResolvedValue('OK'),
        eval: jest.fn().mockResolvedValue(0), // CAS-delete fails — another node owns it
      });
      const svc = makeElection('node-1', client);

      await svc.runElection(); // become leader
      await expect(svc.onModuleDestroy()).resolves.not.toThrow();
      expect(client.eval).toHaveBeenCalled();
    });
  });

  describe('onBecomeLeader callback', () => {
    it('fires registered callback exactly once when leadership is acquired', async () => {
      const client = makeClient({ set: jest.fn().mockResolvedValue('OK') });
      const svc = makeElection('node-1', client);
      const cb = jest.fn();
      svc.onBecomeLeader(cb);

      await svc.runElection();

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not fire callback when lock is not acquired', async () => {
      const client = makeClient(); // set returns null
      const svc = makeElection('node-1', client);
      const cb = jest.fn();
      svc.onBecomeLeader(cb);

      await svc.runElection();

      expect(cb).not.toHaveBeenCalled();
    });

    it('fires callback again when leadership is re-acquired after loss', async () => {
      const setMock = jest.fn()
        .mockResolvedValueOnce('OK')  // acquisition
        .mockResolvedValueOnce('OK'); // re-acquisition
      const evalMock = jest.fn().mockResolvedValue(null); // renewal always fails → loses
      const client = makeClient({ set: setMock, eval: evalMock });
      const svc = makeElection('node-1', client);
      const cb = jest.fn();
      svc.onBecomeLeader(cb);

      await svc.runElection(); // acquires → cb fires (1)
      await svc.runElection(); // renewal fails → loses
      await svc.runElection(); // re-acquires → cb fires (2)

      expect(cb).toHaveBeenCalledTimes(2);
    });
  });

  describe('leadership change logging', () => {
    it('logs when leadership is acquired', async () => {
      const client = makeClient({ set: jest.fn().mockResolvedValue('OK') });
      const svc = makeElection('node-1', client);
      const logSpy = jest.spyOn((svc as any).logger, 'log');

      await svc.runElection();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('acquired'));
    });

    it('logs when leadership is lost', async () => {
      const client = makeClient({
        set: jest.fn().mockResolvedValue('OK'),
        eval: jest.fn().mockResolvedValue(null),
      });
      const svc = makeElection('node-1', client);
      const logSpy = jest.spyOn((svc as any).logger, 'log');

      await svc.runElection(); // acquires
      await svc.runElection(); // loses

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('lost'));
    });
  });
});
