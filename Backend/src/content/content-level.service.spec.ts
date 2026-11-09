import { BadRequestException } from '@nestjs/common';
import { ContentLevelService } from './content-level.service';
import type { SupabaseService } from '../supabase/supabase.service';

/** A profiles table with one row, counting reads; supabase-js fluent API. */
function fakeProfiles(
  row: Record<string, unknown> | null,
  error: unknown = null,
) {
  const calls = { reads: 0, updates: [] as Record<string, unknown>[] };
  const from = () => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = () => {
      calls.reads++;
      return Promise.resolve({ data: row, error });
    };
    q.update = (u: Record<string, unknown>) => {
      calls.updates.push(u);
      if (row) Object.assign(row, u);
      return { eq: () => Promise.resolve({ error: null }) };
    };
    return q;
  };
  const supabase = {
    client: { from },
    reads: { from },
  } as unknown as SupabaseService;
  return { supabase, calls };
}

describe('ContentLevelService (#1101)', () => {
  test('an anonymous caller is off without touching the database', async () => {
    const { supabase, calls } = fakeProfiles({ content_level: 'all' });
    await expect(
      new ContentLevelService(supabase).getLevel(undefined),
    ).resolves.toBe('off');
    expect(calls.reads).toBe(0);
  });

  test('a signed-in level is read once, then served from the short cache', async () => {
    const { supabase, calls } = fakeProfiles({ content_level: 'erotica' });
    const svc = new ContentLevelService(supabase);
    await expect(svc.getLevel('u1')).resolves.toBe('erotica');
    await expect(svc.getLevel('u1')).resolves.toBe('erotica');
    expect(calls.reads).toBe(1);
  });

  test('fails closed: an error or an unknown value is off', async () => {
    const err = fakeProfiles(null, {
      code: '42703',
      message: 'missing column',
    });
    await expect(
      new ContentLevelService(err.supabase).getLevel('u1'),
    ).resolves.toBe('off');
    const odd = fakeProfiles({ content_level: 'everything' });
    await expect(
      new ContentLevelService(odd.supabase).getLevel('u1'),
    ).resolves.toBe('off');
  });

  test('raising without the age confirmed is refused (400) and writes nothing', async () => {
    const { supabase, calls } = fakeProfiles({
      content_level: 'off',
      adult_confirmed_at: null,
      adult_tos_accepted_at: null,
    });
    await expect(
      new ContentLevelService(supabase).setLevel('u1', { level: 'erotica' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calls.updates).toHaveLength(0);
  });

  test('a saved level replaces the cached one at once', async () => {
    const row = {
      content_level: 'off',
      adult_confirmed_at: null,
      adult_tos_accepted_at: null,
    };
    const { supabase, calls } = fakeProfiles(row);
    const svc = new ContentLevelService(supabase);
    await expect(svc.getLevel('u1')).resolves.toBe('off');
    const saved = await svc.setLevel('u1', {
      level: 'all',
      confirmAge: true,
      acceptTos: true,
    });
    expect(saved.level).toBe('all');
    expect(calls.updates[0]).toMatchObject({ content_level: 'all' });
    expect(calls.updates[0].adult_confirmed_at).toEqual(expect.any(String));
    await expect(svc.getLevel('u1')).resolves.toBe('all');
  });
});
