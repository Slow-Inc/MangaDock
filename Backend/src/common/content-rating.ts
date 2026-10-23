/**
 * Opt-in 18+ content (#1101, PRD #1100). A signed-in user's level decides which MangaDex `contentRating`s the
 * catalog fetches; anonymous callers are always `off`. Raising the level is gated: `erotica` needs the age
 * confirmed, `all` (adds `pornographic`) also needs the Terms accepted. The server applies the gate and the ratings,
 * so a client can never ask for more than its level.
 */
export const CONTENT_LEVELS = ['off', 'erotica', 'all'] as const;
export type ContentLevel = (typeof CONTENT_LEVELS)[number];
export type ContentRating = 'safe' | 'suggestive' | 'erotica' | 'pornographic';

const ADULT: ContentRating[] = ['erotica', 'pornographic'];

/** The MangaDex ratings a level allows. */
export function ratingsFor(level: ContentLevel): ContentRating[] {
  if (level === 'all') return ['safe', 'suggestive', 'erotica', 'pornographic'];
  if (level === 'erotica') return ['safe', 'suggestive', 'erotica'];
  return ['safe', 'suggestive'];
}

/** Search ratings: the level, or only its 18+ part for the "เฉพาะ 18+" filter (ignored at `off`). */
export function searchRatings(
  level: ContentLevel,
  adultOnly: boolean,
): ContentRating[] {
  const allowed = ratingsFor(level);
  const adult = allowed.filter((r) => ADULT.includes(r));
  return adultOnly && adult.length ? adult : allowed;
}

/** Appended to catalog cache keys, so 18+ results never reach another level. `off` keeps today's keys. */
export function levelCacheSuffix(level: ContentLevel): string {
  return level === 'off' ? '' : `:r=${level}`;
}

export type ContentRecords = {
  ageConfirmedAt: string | null;
  tosAcceptedAt: string | null;
};

export type LevelChange =
  | ({ ok: true; level: ContentLevel } & ContentRecords)
  | { ok: false; reason: 'age' | 'tos' };

/**
 * The gate for a new level. The confirmations given now are stamped with `now`; earlier ones are kept. Lowering a
 * level never needs anything and never erases the records.
 */
export function applyLevelChange(
  level: ContentLevel,
  current: ContentRecords,
  given: { confirmAge?: boolean; acceptTos?: boolean },
  now: string,
): LevelChange {
  const ageConfirmedAt =
    current.ageConfirmedAt ?? (given.confirmAge ? now : null);
  const tosAcceptedAt = current.tosAcceptedAt ?? (given.acceptTos ? now : null);
  if (level !== 'off' && !ageConfirmedAt) return { ok: false, reason: 'age' };
  if (level === 'all' && !tosAcceptedAt) return { ok: false, reason: 'tos' };
  return { ok: true, level, ageConfirmedAt, tosAcceptedAt };
}

/** What a catalog call fetches and how its cache key is told apart (#1101): threaded from the route to MangaDex. */
export type RatingScope = { ratings: ContentRating[]; key: string };

/** Anonymous / `off`: today's ratings and today's cache keys. */
export const OFF_SCOPE: RatingScope = { ratings: ratingsFor('off'), key: '' };

export function ratingScope(
  level: ContentLevel,
  adultOnly = false,
): RatingScope {
  const narrowed = adultOnly && level !== 'off';
  return {
    ratings: searchRatings(level, adultOnly),
    key: levelCacheSuffix(level) + (narrowed ? ':adult' : ''),
  };
}
