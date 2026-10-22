/**
 * #963: a version or translator id that is not a uuid made Postgres answer 22P02, which these lookups turned into a
 * plain Error — a 500 for what is simply "no such version" / "no versions".
 */
import { NotFoundException } from '@nestjs/common';
import { VersionsService } from './versions.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { StorageProvider } from '../common/storage/storage-provider.interface';

/** A query chain that ends in the given { data, error }, awaited or via maybeSingle(). */
function failingDb(error: { code?: string; message?: string }) {
  const result = { data: null, error };
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'order', 'limit', 'is', 'in'])
    chain[m] = jest.fn().mockReturnValue(chain);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  return { client: chain } as unknown as SupabaseService;
}

const storage = {} as StorageProvider;
const invalidUuid = {
  code: '22P02',
  message: 'invalid input syntax for type uuid',
};

describe('VersionsService — malformed ids (#963)', () => {
  it('getVersion: an id that is not a uuid → 404', async () => {
    const svc = new VersionsService(failingDb(invalidUuid), storage);
    await expect(svc.getVersion('not-a-uuid')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getVersion: any other database failure is not a 404 (the database-down signal)', async () => {
    const svc = new VersionsService(
      failingDb({ code: '57014', message: 'statement timeout' }),
      storage,
    );
    await expect(svc.getVersion('v1')).rejects.toThrow(
      /Supabase lookup failed/,
    );
  });

  it('listPublishedVersionsByTranslator: a translator id that is not a uuid → no versions', async () => {
    const svc = new VersionsService(failingDb(invalidUuid), storage);
    await expect(
      svc.listPublishedVersionsByTranslator('not-a-uuid'),
    ).resolves.toEqual([]);
  });
});
