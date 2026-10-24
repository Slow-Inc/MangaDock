import { createClient } from '@supabase/supabase-js';
import { SUPABASE_READ_TIMEOUT_MS, SupabaseService } from './supabase.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((_url: string, _key: string, opts: unknown) => ({
    opts,
  })),
}));

// #863: reads that are a page's main data get a database timeout; the auth/wallet client does not.
describe('SupabaseService read client (#863)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    (createClient as jest.Mock).mockClear();
  });
  afterAll(() => {
    process.env = env;
  });

  test('`reads` is a separate client whose PostgREST requests time out', () => {
    const s = new SupabaseService();
    s.onModuleInit();
    const reads = s.reads as unknown as { opts: { db?: { timeout?: number } } };
    expect(reads).not.toBe(s.client);
    expect(reads.opts.db?.timeout).toBe(SUPABASE_READ_TIMEOUT_MS);
  });

  test('the main client (auth checks, wallet/unlock writes) keeps no timeout', () => {
    const s = new SupabaseService();
    s.onModuleInit();
    const main = s.client as unknown as { opts: { db?: { timeout?: number } } };
    expect(main.opts.db?.timeout).toBeUndefined();
  });

  test('the budget stays under the 30 s client timeout that the hang hit', () => {
    expect(SUPABASE_READ_TIMEOUT_MS).toBeGreaterThan(0);
    expect(SUPABASE_READ_TIMEOUT_MS).toBeLessThan(30_000);
  });
});
