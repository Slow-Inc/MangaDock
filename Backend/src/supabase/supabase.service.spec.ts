import { SupabaseService } from './supabase.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mint a fake JWT with a chosen exp offset (seconds from now) and subject.
 *  Signature is a dummy string — fetchUser is mocked and tokenExpMsRemaining
 *  only reads `exp`, so signature validity doesn't matter here.
 */
function makeJwt(expOffsetSeconds: number, sub = 'test'): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const payload = Buffer.from(JSON.stringify({ sub, exp })).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.dummysig`;
}

/** Build a real-shaped Supabase getUser success response. */
function getUserOk(id: string, email: string) {
  return {
    data: {
      user: {
        id,
        email,
        user_metadata: { full_name: `User ${id}` },
        identities: [{ provider: 'google' }],
      },
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupabaseService.verifyAccessToken (token-hash cache + single-flight)', () => {
  let service: SupabaseService;
  let mockGetUser: jest.Mock;

  beforeEach(() => {
    service = new SupabaseService();
    mockGetUser = jest.fn();
    // Bypass onModuleInit by injecting a mock Supabase client directly.
    (service as any).supabaseClient = { auth: { getUser: mockGetUser } };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // 1. Cache hit ----------------------------------------------------------------
  it('cache hit: two sequential calls with same token within TTL → getUser called ONCE', async () => {
    const token = makeJwt(3600, 'user-a');
    mockGetUser.mockResolvedValue(getUserOk('uid-1', 'a@test.com'));

    const user1 = await service.verifyAccessToken(token);
    const user2 = await service.verifyAccessToken(token);

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(user1).toEqual(user2);
    expect(user1.uid).toBe('uid-1');
    expect(user1.email).toBe('a@test.com');
  });

  // 2. Single-flight ------------------------------------------------------------
  it('single-flight: N concurrent calls with same token → getUser called ONCE', async () => {
    const token = makeJwt(3600, 'user-sf');

    let resolveGetUser!: (value: any) => void;
    const pending = new Promise<any>((resolve) => {
      resolveGetUser = resolve;
    });
    mockGetUser.mockReturnValue(pending);

    // Fire 3 concurrent calls BEFORE getUser resolves (single-flight must coalesce them).
    const calls = [
      service.verifyAccessToken(token),
      service.verifyAccessToken(token),
      service.verifyAccessToken(token),
    ];

    // Now let getUser resolve.
    resolveGetUser(getUserOk('uid-sf', 'sf@test.com'));

    const results = await Promise.all(calls);

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    results.forEach((user) => {
      expect(user.uid).toBe('uid-sf');
      expect(user.email).toBe('sf@test.com');
    });
  });

  // 3. TTL expiry ---------------------------------------------------------------
  it('TTL expiry: call after 60 s TTL → getUser re-invoked', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const token = makeJwt(3600, 'user-ttl'); // exp well beyond 60 s TTL
    mockGetUser.mockResolvedValue(getUserOk('uid-ttl', 'ttl@test.com'));

    await service.verifyAccessToken(token);
    expect(mockGetUser).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(61_000); // past 60 s TTL

    await service.verifyAccessToken(token);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });

  // 4. exp-bound TTL ------------------------------------------------------------
  it('exp bound: token exp < 60 s → cache expires at token exp, not TTL', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    const shortToken = makeJwt(30, 'user-exp'); // exp in 30 s, TTL cap is 60 s
    mockGetUser.mockResolvedValue(getUserOk('uid-exp', 'exp@test.com'));

    await service.verifyAccessToken(shortToken);
    expect(mockGetUser).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(29_000); // 29 s: still before token exp
    await service.verifyAccessToken(shortToken);
    expect(mockGetUser).toHaveBeenCalledTimes(1); // still cached

    jest.advanceTimersByTime(2_000); // 31 s total: past token exp
    await service.verifyAccessToken(shortToken);
    expect(mockGetUser).toHaveBeenCalledTimes(2); // re-invoked
  });

  // 5. Distinct tokens (no cross-token bleed) -----------------------------------
  it('distinct tokens: different tokens → separate getUser calls, each returns own identity', async () => {
    const tokenA = makeJwt(3600, 'user-a');
    const tokenB = makeJwt(3600, 'user-b');

    mockGetUser
      .mockResolvedValueOnce(getUserOk('uid-A', 'a@test.com'))
      .mockResolvedValueOnce(getUserOk('uid-B', 'b@test.com'));

    const userA = await service.verifyAccessToken(tokenA);
    const userB = await service.verifyAccessToken(tokenB);

    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(userA.uid).toBe('uid-A');
    expect(userB.uid).toBe('uid-B');

    // Subsequent calls serve from cache — identities must not bleed.
    const userA2 = await service.verifyAccessToken(tokenA);
    const userB2 = await service.verifyAccessToken(tokenB);
    expect(mockGetUser).toHaveBeenCalledTimes(2); // still 2 — both served from cache
    expect(userA2.uid).toBe('uid-A');
    expect(userB2.uid).toBe('uid-B');
  });

  // 6. Errors not cached --------------------------------------------------------
  it('errors not cached: failed verifyAccessToken not cached; second call re-invokes getUser', async () => {
    const token = makeJwt(3600, 'user-err');
    mockGetUser
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid JWT' } })
      .mockResolvedValueOnce(getUserOk('uid-retry', 'retry@test.com'));

    await expect(service.verifyAccessToken(token)).rejects.toThrow('Invalid or expired token');

    // Second call MUST re-invoke getUser — nothing was cached from the failure.
    const user = await service.verifyAccessToken(token);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    expect(user.uid).toBe('uid-retry');
  });
});
