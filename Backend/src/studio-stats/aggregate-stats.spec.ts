import { aggregateStats, creatorShare } from './aggregate-stats';

const NOW = new Date('2026-10-20T10:00:00Z');

const versions = [
  {
    version_id: 'v1',
    title_id: 't1',
    title_name: 'Alpha',
    created_at: '2026-10-18T03:00:00Z',
  },
  {
    version_id: 'v2',
    title_id: 't1',
    title_name: 'Alpha',
    created_at: '2026-10-20T01:00:00Z',
  },
  {
    version_id: 'v3',
    title_id: 't2',
    title_name: 'Beta',
    created_at: '2026-09-01T00:00:00Z',
  },
];

const unlocks = [
  { version_id: 'v1', price_paid: 10, unlocked_at: '2026-10-19T08:00:00Z' },
  { version_id: 'v1', price_paid: 10, unlocked_at: '2026-10-20T09:00:00Z' },
  { version_id: 'v3', price_paid: 5, unlocked_at: '2026-10-20T02:00:00Z' },
  { version_id: 'v3', price_paid: 5, unlocked_at: '2026-10-01T02:00:00Z' }, // outside a 7-day window
];

describe('creatorShare — same split as purchase_unlock_atomic (platform = floor(price * 0.3))', () => {
  it('gives the creator what the platform does not take', () => {
    expect(creatorShare(10)).toBe(7);
    expect(creatorShare(5)).toBe(4); // floor(1.5) = 1 to the platform
    expect(creatorShare(0)).toBe(0);
  });
});

describe('aggregateStats', () => {
  const s = aggregateStats(versions, unlocks, 7, NOW);

  it('returns one row per UTC day for the window, oldest first, ending today', () => {
    expect(s.days.map((d) => d.date)).toEqual([
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
    ]);
  });

  it('counts unlocks, gross revenue and the creator share per day', () => {
    expect(s.days.find((d) => d.date === '2026-10-19')).toEqual({
      date: '2026-10-19',
      unlocks: 1,
      revenue: 10,
      earnings: 7,
      uploads: 0,
    });
    expect(s.days.find((d) => d.date === '2026-10-20')).toEqual({
      date: '2026-10-20',
      unlocks: 2,
      revenue: 15,
      earnings: 11,
      uploads: 1,
    });
    expect(s.days.find((d) => d.date === '2026-10-18')?.uploads).toBe(1);
  });

  it('ignores unlocks outside the window', () => {
    expect(s.totals).toEqual({
      unlocks: 3,
      revenue: 25,
      earnings: 18,
      uploads: 2,
    });
  });

  it('ranks titles by unlocks in the window', () => {
    expect(s.titles).toEqual([
      { titleId: 't1', titleName: 'Alpha', unlocks: 2, revenue: 20 },
      { titleId: 't2', titleName: 'Beta', unlocks: 1, revenue: 5 },
    ]);
  });

  it('an unlock for a version the creator does not own is dropped, not counted', () => {
    const t = aggregateStats(
      versions,
      [
        {
          version_id: 'someone-else',
          price_paid: 99,
          unlocked_at: '2026-10-20T00:00:00Z',
        },
      ],
      7,
      NOW,
    );
    expect(t.totals.unlocks).toBe(0);
  });

  it('caps the window at 365 days and at least 1', () => {
    expect(aggregateStats([], [], 9999, NOW).days).toHaveLength(365);
    expect(aggregateStats([], [], 0, NOW).days).toHaveLength(1);
  });
});
