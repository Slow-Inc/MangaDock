import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { STORAGE_PROVIDER } from '../common/storage/storage-provider.interface';
import type { MascotDto } from './mascot.dto';

const MASCOT: MascotDto = {
  type: 'cat',
  face: 'mouth',
  hat: 'party',
  glasses: 'none',
  headphones: false,
  bowTie: true,
};

/** A chainable Supabase double that records the calls the service makes. */
function makeService(row: { mascot: unknown } | null, error: unknown = null) {
  const calls: { op: string; args: unknown[] }[] = [];
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  for (const op of ['select', 'update', 'eq']) {
    chain[op] = (...args: unknown[]) => {
      calls.push({ op, args });
      return chain;
    };
  }
  chain.maybeSingle = () => Promise.resolve({ data: row, error });
  // update(...).eq(...) is awaited directly
  (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ error });
  const from = jest.fn().mockReturnValue(chain);
  return {
    from,
    calls,
    build: async () => {
      const mod = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: SupabaseService, useValue: { client: { from } } },
          { provide: STORAGE_PROVIDER, useValue: {} },
        ],
      }).compile();
      return mod.get(UsersService);
    },
  };
}

describe('UsersService mascot', () => {
  it('reads the caller’s saved mascot', async () => {
    const t = makeService({ mascot: MASCOT });
    const svc = await t.build();
    expect(await svc.getMascot('uid-1')).toEqual(MASCOT);
    expect(t.from).toHaveBeenCalledWith('profiles');
    expect(t.calls).toContainEqual({ op: 'eq', args: ['uid', 'uid-1'] });
  });

  it('returns null when the user never dressed one', async () => {
    const svc = await makeService({ mascot: null }).build();
    expect(await svc.getMascot('uid-1')).toBeNull();
  });

  it('saves only the given mascot on the caller’s own row', async () => {
    const t = makeService(null);
    const svc = await t.build();
    await svc.setMascot('uid-2', MASCOT);
    const update = t.calls.find((c) => c.op === 'update');
    expect(update?.args[0]).toMatchObject({ mascot: MASCOT });
    expect(t.calls).toContainEqual({ op: 'eq', args: ['uid', 'uid-2'] });
  });

  it('surfaces a database error instead of pretending it saved', async () => {
    const svc = await makeService(null, { message: 'boom' }).build();
    await expect(svc.setMascot('uid-3', MASCOT)).rejects.toThrow('boom');
  });
});
