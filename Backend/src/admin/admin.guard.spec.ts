import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { ROLE } from '../users/users.service';

function buildCtx(uid: string | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ uid }) }),
  } as unknown as ExecutionContext;
}

function buildSupabase(role: number | null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: role !== null ? { role } : null }),
  };
  return { client: { from: jest.fn(() => chain) } };
}

describe('AdminGuard', () => {
  it('allows role 8 (admin)', async () => {
    const guard = new AdminGuard(buildSupabase(ROLE.ADMIN) as any);
    await expect(guard.canActivate(buildCtx('uid-a'))).resolves.toBe(true);
  });

  it('allows role 9 (dev)', async () => {
    const guard = new AdminGuard(buildSupabase(ROLE.DEV) as any);
    await expect(guard.canActivate(buildCtx('uid-a'))).resolves.toBe(true);
  });

  it.each([0, 1, 2, 7])('rejects role %i', async (role) => {
    const guard = new AdminGuard(buildSupabase(role) as any);
    await expect(guard.canActivate(buildCtx('uid-a'))).rejects.toThrow(ForbiddenException);
  });

  it('rejects missing uid', async () => {
    const guard = new AdminGuard(buildSupabase(ROLE.ADMIN) as any);
    await expect(guard.canActivate(buildCtx(undefined))).rejects.toThrow(ForbiddenException);
  });

  it('rejects profile not found (null data)', async () => {
    const guard = new AdminGuard(buildSupabase(null) as any);
    await expect(guard.canActivate(buildCtx('uid-a'))).rejects.toThrow(ForbiddenException);
  });
});
