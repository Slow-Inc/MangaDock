import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  aggregateStats,
  MAX_DAYS,
  type CreatorStats,
  type UnlockRow,
  type VersionRow,
} from './aggregate-stats';

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

    const { data: versions, error: vErr } = await this.db
      .from('chapter_versions')
      .select('id, title_id, title_name, created_at')
      .eq('translator_uid', uid);
    if (vErr) throw new Error(`Failed to load versions: ${vErr.message}`);
    const owned = (versions ?? []) as VersionRow[];
    if (owned.length === 0) return aggregateStats([], [], n, now);

    const { data: unlocks, error: uErr } = await this.db
      .from('unlocks')
      .select('version_id, price_paid, unlocked_at')
      .in(
        'version_id',
        owned.map((v) => v.id),
      )
      .gte('unlocked_at', since);
    if (uErr) throw new Error(`Failed to load unlocks: ${uErr.message}`);

    return aggregateStats(owned, (unlocks ?? []) as UnlockRow[], n, now);
  }
}
