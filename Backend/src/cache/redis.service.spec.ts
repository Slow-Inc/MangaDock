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
