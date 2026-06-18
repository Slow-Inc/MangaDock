import { OptionalAuthGuard } from './optional-auth.guard';
import { UID_KEY, USER_KEY } from './auth.guard';
import type { SupabaseAuthUser } from './auth.types';

const mockVerify = jest.fn();
const mockSupabase = { verifyAccessToken: mockVerify } as any;

describe('OptionalAuthGuard', () => {
  let guard: OptionalAuthGuard;

  beforeEach(() => {
    guard = new OptionalAuthGuard(mockSupabase);
    mockVerify.mockReset();
  });

  it('no token → returns true, req.user unset (anonymous allowed through)', async () => {
    const req = { headers: {} };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req[USER_KEY]).toBeUndefined();
    expect(req[UID_KEY]).toBeUndefined();
  });

  it('valid token → returns true and attaches user + uid', async () => {
    const user: SupabaseAuthUser = {
      uid: 'user-456',
      email: 'a@b.com',
      name: 'Alice',
      picture: null,
      providers: ['email'],
    };
    mockVerify.mockResolvedValue(user);
    const req = { headers: { authorization: 'Bearer valid.jwt.token' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req[USER_KEY]).toEqual(user);
    expect(req[UID_KEY]).toBe('user-456');
  });

  it('invalid token → returns true but req.user unset (invalid treated as anonymous, not error)', async () => {
    mockVerify.mockRejectedValue(new Error('invalid token'));
    const req = { headers: { authorization: 'Bearer bad.token' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req[USER_KEY]).toBeUndefined();
  });
});
