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
