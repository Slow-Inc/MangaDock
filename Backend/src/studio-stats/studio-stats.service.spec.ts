import { StudioStatsService } from './studio-stats.service';
import type { SupabaseService } from '../supabase/supabase.service';

type Call = { table: string; op: string; args: unknown[] };

function makeDb(tables: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
      chain[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: tables[table] ?? [], error: null });
    return chain;
  };
  return {
    calls,
    svc: new StudioStatsService({
      client: { from },
    } as unknown as SupabaseService),
  };
}

const NOW = new Date('2026-10-20T10:00:00Z');

describe('StudioStatsService — money rows are read only for the caller’s own versions', () => {
  it('selects versions by translator_uid and unlocks only for those version ids, inside the window', async () => {
    const { calls, svc } = makeDb({
      chapter_versions: [
        {
          version_id: 'v1',
          title_id: 't1',
          title_name: 'A',
          created_at: '2026-10-19T00:00:00Z',
        },
      ],
      unlocks: [
        {
          version_id: 'v1',
          price_paid: 10,
          unlocked_at: '2026-10-20T01:00:00Z',
        },
      ],
    });
    const stats = await svc.getStats('creator-1', 7, NOW);

    expect(calls).toContainEqual({
      table: 'chapter_versions',
      op: 'eq',
      args: ['translator_uid', 'creator-1'],
    });
    expect(calls).toContainEqual({
      table: 'unlocks',
      op: 'in',
      args: ['version_id', ['v1']],
    });
    expect(calls).toContainEqual({
      table: 'unlocks',
      op: 'gte',
      args: ['unlocked_at', '2026-10-14T00:00:00.000Z'],
    });
    expect(stats.totals).toEqual({
      unlocks: 1,
      revenue: 10,
      earnings: 7,
      uploads: 1,
    });
  });

  it('a creator with no versions never queries unlocks', async () => {
    const { calls, svc } = makeDb({ chapter_versions: [] });
    const stats = await svc.getStats('nobody', 30, NOW);
    expect(calls.some((c) => c.table === 'unlocks')).toBe(false);
    expect(stats.totals.unlocks).toBe(0);
    expect(stats.days).toHaveLength(30);
  });
});
