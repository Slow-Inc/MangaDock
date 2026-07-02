import { RedisService } from './redis.service';

function makeService() {
  const svc = new RedisService();
  return svc;
}

describe('RedisService — getClient()', () => {
  it('returns null when not connected (isConnected=false, client set)', async () => {
    const svc = makeService();
    (svc as any).client = {} as any; // client object exists but disconnected
    (svc as any).isConnected = false;

    const result = await svc.getClient();

    expect(result).toBeNull();
  });

  it('returns the client when connected', async () => {
    const mockClient = { id: 'mock' } as any;
    const svc = makeService();
    (svc as any).client = mockClient;
    (svc as any).isConnected = true;

    const result = await svc.getClient();

    expect(result).toBe(mockClient);
  });

  it('returns null when client is null (never connected)', async () => {
    const svc = makeService();
    // client stays null from initialization

    const result = await svc.getClient();

    expect(result).toBeNull();
  });
});

describe('RedisService — incrWithTtl() is atomic', () => {
  it('increments and sets the TTL in a single EVAL round-trip (INCR + conditional EXPIRE)', async () => {
    const evalFn = jest.fn().mockResolvedValue(1);
    const incr = jest.fn();
    const expire = jest.fn();
    const svc = makeService();
    (svc as any).client = { eval: evalFn, incr, expire } as any;
    (svc as any).isConnected = true;

    const count = await svc.incrWithTtl('rl:u1', 60);

    expect(count).toBe(1);
    // Atomicity: one EVAL, never a separate incr() + expire() (the immortal-key race).
    expect(evalFn).toHaveBeenCalledTimes(1);
    expect(incr).not.toHaveBeenCalled();
    expect(expire).not.toHaveBeenCalled();
    const [script, numKeys, key, ttl] = evalFn.mock.calls[0];
    expect(String(script)).toContain('INCR');
    expect(String(script)).toContain('EXPIRE');
    expect(numKeys).toBe(1);
    expect(key).toBe('rl:u1');
    expect(ttl).toBe('60');
  });

  it('only EXPIREs on the first increment (script guards on n == 1)', async () => {
    const evalFn = jest.fn().mockResolvedValue(3);
    const svc = makeService();
    (svc as any).client = { eval: evalFn } as any;
    (svc as any).isConnected = true;

    const count = await svc.incrWithTtl('rl:u1', 60);

    expect(count).toBe(3);
    // The window must not slide: the script itself decides when to set the TTL.
    expect(String(evalFn.mock.calls[0][0])).toContain('== 1');
  });

  it('returns 0 (fail-open) and issues no EVAL when Redis is unavailable', async () => {
    const evalFn = jest.fn();
    const svc = makeService();
    (svc as any).client = { eval: evalFn } as any;
    (svc as any).isConnected = false;

    const count = await svc.incrWithTtl('rl:u1', 60);

    expect(count).toBe(0);
    expect(evalFn).not.toHaveBeenCalled();
  });

  it('returns 0 (fail-open) when the client throws', async () => {
    const evalFn = jest.fn().mockRejectedValue(new Error('connection lost'));
    const svc = makeService();
    (svc as any).client = { eval: evalFn } as any;
    (svc as any).isConnected = true;

    const count = await svc.incrWithTtl('rl:u1', 60);

    expect(count).toBe(0);
  });
});

describe('RedisService — keys() uses a SCAN cursor loop', () => {
  it('follows the cursor until it returns to "0", passing the same MATCH pattern each iteration', async () => {
    // Non-terminal cursors ('42', '7') then '0' — a naive single-SCAN impl
    // would stop after the first batch and return only ['a', 'b'].
    const scan = jest
      .fn()
      .mockResolvedValueOnce(['42', ['a', 'b']])
      .mockResolvedValueOnce(['7', ['c']])
      .mockResolvedValueOnce(['0', ['d']]);
    const svc = makeService();
    (svc as any).client = { scan } as any;
    (svc as any).isConnected = true;

    const result = await svc.keys('translate:*');

    expect(result.sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(scan).toHaveBeenCalledTimes(3);
    expect(scan).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'translate:*', 'COUNT', expect.any(Number));
    expect(scan).toHaveBeenNthCalledWith(2, '42', 'MATCH', 'translate:*', 'COUNT', expect.any(Number));
    expect(scan).toHaveBeenNthCalledWith(3, '7', 'MATCH', 'translate:*', 'COUNT', expect.any(Number));
  });

  it('de-duplicates keys returned across iterations (SCAN can repeat keys)', async () => {
    const scan = jest
      .fn()
      .mockResolvedValueOnce(['9', ['x', 'y']])
      .mockResolvedValueOnce(['0', ['y', 'z']]);
    const svc = makeService();
    (svc as any).client = { scan } as any;
    (svc as any).isConnected = true;

    const result = await svc.keys('*');

    expect(result.sort()).toEqual(['x', 'y', 'z']);
  });

  it('returns [] and issues no SCAN when Redis is unavailable', async () => {
    const scan = jest.fn();
    const svc = makeService();
    (svc as any).client = { scan } as any;
    (svc as any).isConnected = false;

    const result = await svc.keys('*');

    expect(result).toEqual([]);
    expect(scan).not.toHaveBeenCalled();
  });

  it('returns [] when the client throws mid-scan', async () => {
    const scan = jest.fn().mockRejectedValue(new Error('connection lost'));
    const svc = makeService();
    (svc as any).client = { scan } as any;
    (svc as any).isConnected = true;

    const result = await svc.keys('*');

    expect(result).toEqual([]);
  });
});
