import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  applyLevelChange,
  CONTENT_LEVELS,
  type ContentLevel,
} from '../common/content-rating';

/** How long a user's level is served from memory; a save replaces it at once. */
const LEVEL_TTL_MS = 60_000;

export type ContentSettings = {
  level: ContentLevel;
  ageConfirmedAt: string | null;
  tosAcceptedAt: string | null;
};

type Row = {
  content_level: string | null;
  adult_confirmed_at: string | null;
  adult_tos_accepted_at: string | null;
};

const asLevel = (v: unknown): ContentLevel =>
  (CONTENT_LEVELS as readonly unknown[]).includes(v)
    ? (v as ContentLevel)
    : 'off';

/**
 * A user's 18+ content level (#1101, PRD #1100). The catalog asks it on every request, so it is cached briefly
 * per user; anonymous callers and any read failure are `off` (fail closed).
 */
@Injectable()
export class ContentLevelService {
  private readonly cache = new Map<
    string,
    { level: ContentLevel; at: number }
  >();

  constructor(private readonly supabase: SupabaseService) {}

  async getLevel(uid: string | undefined): Promise<ContentLevel> {
    if (!uid) return 'off';
    const hit = this.cache.get(uid);
    if (hit && Date.now() - hit.at < LEVEL_TTL_MS) return hit.level;
    const { data, error } = await this.supabase.reads
      .from('profiles')
      .select('content_level')
      .eq('uid', uid)
      .maybeSingle<Pick<Row, 'content_level'>>();
    const level = error ? 'off' : asLevel(data?.content_level);
    this.cache.set(uid, { level, at: Date.now() });
    return level;
  }

  async getSettings(uid: string): Promise<ContentSettings> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('content_level, adult_confirmed_at, adult_tos_accepted_at')
      .eq('uid', uid)
      .maybeSingle<Row>();
    if (error)
      throw new Error(`Failed to read content settings: ${error.message}`);
    return {
      level: asLevel(data?.content_level),
      ageConfirmedAt: data?.adult_confirmed_at ?? null,
      tosAcceptedAt: data?.adult_tos_accepted_at ?? null,
    };
  }

  /** Applies the gate (age for `erotica`, age + Terms for `all`), saves, and replaces the cached level. */
  async setLevel(
    uid: string,
    body: { level: ContentLevel; confirmAge?: boolean; acceptTos?: boolean },
  ): Promise<ContentSettings> {
    const current = await this.getSettings(uid);
    const change = applyLevelChange(
      body.level,
      current,
      body,
      new Date().toISOString(),
    );
    if (!change.ok) {
      throw new BadRequestException(
        change.reason === 'age'
          ? 'Confirm that you are 18 or older first'
          : 'Accept the Terms first',
      );
    }
    const { error } = await this.supabase.client
      .from('profiles')
      .update({
        content_level: change.level,
        adult_confirmed_at: change.ageConfirmedAt,
        adult_tos_accepted_at: change.tosAcceptedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', uid);
    if (error)
      throw new Error(`Failed to save content settings: ${error.message}`);
    this.cache.set(uid, { level: change.level, at: Date.now() });
    return {
      level: change.level,
      ageConfirmedAt: change.ageConfirmedAt,
      tosAcceptedAt: change.tosAcceptedAt,
    };
  }
}
