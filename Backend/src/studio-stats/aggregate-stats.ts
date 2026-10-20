/**
 * Creator stats for the Studio dashboard (Epic C #787), computed from rows the service has already
 * scoped to the caller's own versions. Pure, so it is unit-tested without Supabase.
 */
export type VersionRow = {
  id: string;
  title_id: string;
  title_name: string | null;
  created_at: string;
};
export type UnlockRow = {
  version_id: string;
  price_paid: number;
  unlocked_at: string;
};

export type DayStat = {
  date: string;
  unlocks: number;
  revenue: number;
  earnings: number;
  uploads: number;
};
export type TitleStat = {
  titleId: string;
  titleName: string;
  unlocks: number;
  revenue: number;
};
export type CreatorStats = {
  days: DayStat[];
  titles: TitleStat[];
  totals: {
    unlocks: number;
    revenue: number;
    earnings: number;
    uploads: number;
  };
};

/** Platform cut used by purchase_unlock_atomic (unlock.service.ts passes p_platform_pct: 0.3). */
const PLATFORM_PCT = 0.3;
export const MAX_DAYS = 365;

/** What the creator receives for one unlock: the platform takes floor(price * 0.3). */
export function creatorShare(price: number): number {
  return price - Math.floor(price * PLATFORM_PCT);
}

const dayKey = (iso: string | Date) => new Date(iso).toISOString().slice(0, 10);

export function aggregateStats(
  versions: VersionRow[],
  unlocks: UnlockRow[],
  days: number,
  now = new Date(),
): CreatorStats {
  const n = Math.min(MAX_DAYS, Math.max(1, Math.floor(days) || 1));
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const byDay = new Map<string, DayStat>();
  for (let i = n - 1; i >= 0; i--) {
    const date = dayKey(new Date(today - i * 86_400_000));
    byDay.set(date, { date, unlocks: 0, revenue: 0, earnings: 0, uploads: 0 });
  }

  const owned = new Map(versions.map((v) => [v.id, v]));
  const titles = new Map<string, TitleStat>();

  for (const u of unlocks) {
    const v = owned.get(u.version_id);
    const day = byDay.get(dayKey(u.unlocked_at));
    if (!v || !day) continue; // not the caller's version, or outside the window
    const price = Number(u.price_paid) || 0;
    day.unlocks += 1;
    day.revenue += price;
    day.earnings += creatorShare(price);
    const t = titles.get(v.title_id) ?? {
      titleId: v.title_id,
      titleName: v.title_name ?? '',
      unlocks: 0,
      revenue: 0,
    };
    t.unlocks += 1;
    t.revenue += price;
    titles.set(v.title_id, t);
  }

  for (const v of versions) {
    const day = byDay.get(dayKey(v.created_at));
    if (day) day.uploads += 1;
  }

  const dayList = [...byDay.values()];
  const totals = dayList.reduce(
    (acc, d) => ({
      unlocks: acc.unlocks + d.unlocks,
      revenue: acc.revenue + d.revenue,
      earnings: acc.earnings + d.earnings,
      uploads: acc.uploads + d.uploads,
    }),
    { unlocks: 0, revenue: 0, earnings: 0, uploads: 0 },
  );

  return {
    days: dayList,
    titles: [...titles.values()].sort(
      (a, b) => b.unlocks - a.unlocks || b.revenue - a.revenue,
    ),
    totals,
  };
}
