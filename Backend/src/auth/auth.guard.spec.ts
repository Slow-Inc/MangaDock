import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard, UID_KEY, USER_KEY } from './auth.guard';
import type { SupabaseAuthUser } from './auth.types';

const mockVerify = jest.fn();
const mockSupabase = { verifyAccessToken: mockVerify } as any;

function makeCtx(headers: Record<string, string>) {
  const req = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    guard = new AuthGuard(mockSupabase);
    mockVerify.mockReset();
  });

  it('no Authorization header → throws UnauthorizedException', async () => {
    await expect(guard.canActivate(makeCtx({}))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('Authorization without Bearer prefix → throws UnauthorizedException', async () => {
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Basic abc123' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('valid Bearer JWT → returns true, attaches user + uid to request', async () => {
    const user: SupabaseAuthUser = {
      uid: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: null,
      providers: ['google'],
    };
    mockVerify.mockResolvedValue(user);
    const req = { headers: { authorization: 'Bearer valid.jwt.token' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req[USER_KEY]).toEqual(user);
    expect(req[UID_KEY]).toBe('user-123');
  });

  it('expired/invalid JWT → throws UnauthorizedException', async () => {
    mockVerify.mockRejectedValue(new Error('JWT expired'));
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer expired.token' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('Supabase service throws → throws UnauthorizedException (no 500 leak)', async () => {
    mockVerify.mockRejectedValue(new Error('Supabase unavailable'));
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer some.token' })),
    ).rejects.toThrow(UnauthorizedException);
  });
});
