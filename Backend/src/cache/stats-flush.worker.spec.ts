import { StatsFlushWorker } from './stats-flush.worker';
import { RedisService } from './redis.service';
import { ElectionService } from '../status/election.service';
import { SupabaseService } from '../supabase/supabase.service';

function makeRedis(activeChapters: string[] = [], viewCounts: Record<string, number> = {}, hllCounts: Record<string, number> = {}): jest.Mocked<Pick<RedisService, 'smembers' | 'get' | 'pfcount'>> {
  return {
    smembers: jest.fn().mockResolvedValue(activeChapters),
    get: jest.fn().mockImplementation((key: string) => {
      const chapterId = key.split(':views:')[0].replace('stats:chapter:', '');
      return Promise.resolve(viewCounts[chapterId] != null ? String(viewCounts[chapterId]) : null);
    }),
    pfcount: jest.fn().mockImplementation((key: string) => {
      const chapterId = key.split(':hll:')[0].replace('stats:chapter:', '');
      return Promise.resolve(hllCounts[chapterId] ?? 0);
    }),
  } as any;
}

function makeElection(isLeader = true): jest.Mocked<Pick<ElectionService, 'isLeader'>> {
  return { isLeader } as any;
}

function makeSupabase(): { client: any } {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({ upsert });
  return { client: { from } };
}

function makeWorker(overrides: {
  isLeader?: boolean;
  activeChapters?: string[];
  viewCounts?: Record<string, number>;
  hllCounts?: Record<string, number>;
  supabase?: any;
} = {}) {
  const redis = makeRedis(overrides.activeChapters ?? [], overrides.viewCounts ?? {}, overrides.hllCounts ?? {});
  const election = makeElection(overrides.isLeader ?? true);
  const supabase = overrides.supabase ?? makeSupabase();
  const worker = new StatsFlushWorker(redis as unknown as RedisService, election as unknown as ElectionService, supabase as unknown as SupabaseService);
  return { worker, redis, election, supabase };
}

describe('StatsFlushWorker', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Cycle 1 — skip when not leader
  it('flush() does nothing when node is not leader', async () => {
    const { worker, redis } = makeWorker({ isLeader: false });

    await worker.flush();

    expect(redis.smembers).not.toHaveBeenCalled();
  });

  // Cycle 2 — upsert per active chapter
  it('flush() upserts one row per active chapter with views and unique readers', async () => {
    const supabase = makeSupabase();
    const { worker } = makeWorker({
      activeChapters: ['ch:1'],
      viewCounts: { 'ch:1': 42 },
      hllCounts: { 'ch:1': 7 },
      supabase,
    });

    await worker.flush();

    expect(supabase.client.from).toHaveBeenCalledWith('chapter_daily_stats');
    const upsertCall = supabase.client.from().upsert.mock.calls[0][0];
    expect(upsertCall).toMatchObject({ chapter_id: 'ch:1', views: 42, unique_readers: 7 });
  });

  // Cycle 3 — empty active set: no Supabase call
  it('flush() makes no Supabase call when active set is empty', async () => {
    const supabase = makeSupabase();
    const { worker } = makeWorker({ activeChapters: [], supabase });

    await worker.flush();

    expect(supabase.client.from).not.toHaveBeenCalled();
  });

  // Cycle 4 — Supabase error: swallowed, no throw
  it('flush() does not throw when Supabase upsert returns an error', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: { message: 'DB down' } });
    const from = jest.fn().mockReturnValue({ upsert });
    const supabase = { client: { from } };
    const { worker } = makeWorker({ activeChapters: ['ch:1'], viewCounts: { 'ch:1': 1 }, supabase });

    await expect(worker.flush()).resolves.not.toThrow();
  });

  // Cycle 6 — also drains yesterday's trailing window
  it('flush() also processes yesterday\'s active set when called with no argument', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const supabase = makeSupabase();
    const redis = {
      smembers: jest.fn().mockImplementation((key: string) =>
        Promise.resolve(key === `stats:active:${yesterday}` ? ['ch:1'] : []),
      ),
      get: jest.fn().mockResolvedValue(null),
      pfcount: jest.fn().mockResolvedValue(0),
    };
    const election = makeElection(true);
    const worker = new StatsFlushWorker(
      redis as unknown as RedisService,
      election as unknown as ElectionService,
      supabase as unknown as SupabaseService,
    );

    await worker.flush();

    const queriedKeys = (redis.smembers as jest.Mock).mock.calls.map(([k]: [string]) => k);
    expect(queriedKeys).toContain(`stats:active:${yesterday}`);
    expect(supabase.client.from).toHaveBeenCalledWith('chapter_daily_stats');
  });

  // Cycle 5 — onModuleDestroy stops interval
  it('onModuleDestroy clears the flush interval — no further flushes fire', async () => {
    jest.useFakeTimers();
    const { worker, redis } = makeWorker({ isLeader: true, activeChapters: [] });

    worker.onModuleInit();
    worker.onModuleDestroy();
    redis.smembers.mockClear();

    jest.advanceTimersByTime(5 * 60 * 1000);
    await Promise.resolve();

    expect(redis.smembers).not.toHaveBeenCalled();
  });
});
