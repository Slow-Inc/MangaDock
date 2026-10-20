import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  aggregateStats,
  MAX_DAYS,
  type CreatorStats,
  type UnlockRow,
  type VersionRow,
} from './aggregate-stats';

const PAGE = 1000; // PostgREST's default max rows per request
const ID_CHUNK = 100; // ~3.7 kB of UUIDs per request URL

/** Reads every row of a query by paging with .range() until a short page comes back. */
async function readAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load studio stats: ${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

/**
 * Creator stats for the Studio dashboard (Epic C #787). Ownership is the same rule Studio already uses
 * (`chapter_versions.translator_uid = caller`, versions.service.ts): unlock rows are read only for the
 * caller's own version ids, so no other creator's sales can leak into the series.
 * Read-only; the unlock / wallet modules are not touched.
 */
@Injectable()
export class StudioStatsService {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.client;
  }

  async getStats(
    uid: string,
    days: number,
    now = new Date(),
  ): Promise<CreatorStats> {
    const n = Math.min(MAX_DAYS, Math.max(1, Math.floor(days) || 1));
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        (n - 1) * 86_400_000,
    ).toISOString();

    const owned = await readAll<VersionRow>((a, b) =>
      this.db
        .from('chapter_versions')
        .select('version_id, title_id, title_name, created_at')
        .eq('translator_uid', uid)
        .order('version_id')
        .range(a, b),
    );
    if (owned.length === 0) return aggregateStats([], [], n, now);

    // Ids go in the request URL, so ask in chunks; each chunk is paged past PostgREST's 1000-row cap.
    const unlocks: UnlockRow[] = [];
    for (let i = 0; i < owned.length; i += ID_CHUNK) {
      const ids = owned.slice(i, i + ID_CHUNK).map((v) => v.version_id);
      unlocks.push(
        ...(await readAll<UnlockRow>((a, b) =>
          this.db
            .from('unlocks')
            .select('version_id, price_paid, unlocked_at')
            .in('version_id', ids)
            .gte('unlocked_at', since)
            .order('unlocked_at')
            .range(a, b),
        )),
      );
    }

    return aggregateStats(owned, unlocks, n, now);
  }
}
