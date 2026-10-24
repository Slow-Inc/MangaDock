import {
  applyLevelChange,
  levelCacheSuffix,
  OFF_SCOPE,
  ratingScope,
  ratingsFor,
  searchRatings,
} from './content-rating';

// #1101 (PRD #1100): which MangaDex ratings a caller's level allows, and the gate for raising it.
describe('ratingsFor', () => {
  test('off (and every anonymous caller) is safe only (#1105)', () => {
    expect(ratingsFor('off')).toEqual(['safe']);
  });
  test('suggestive adds suggestive; erotica adds erotica; all adds pornographic too', () => {
    expect(ratingsFor('suggestive')).toEqual(['safe', 'suggestive']);
    expect(ratingsFor('erotica')).toEqual(['safe', 'suggestive', 'erotica']);
    expect(ratingsFor('all')).toEqual([
      'safe',
      'suggestive',
      'erotica',
      'pornographic',
    ]);
  });
});

describe('searchRatings (the "เฉพาะ 18+" filter)', () => {
  test('adult-only narrows to the 18+ ratings the level allows', () => {
    expect(searchRatings('erotica', true)).toEqual(['erotica']);
    expect(searchRatings('all', true)).toEqual(['erotica', 'pornographic']);
  });
  test('ignored below erotica: a client cannot ask for more than its level', () => {
    expect(searchRatings('off', true)).toEqual(['safe']);
    expect(searchRatings('suggestive', true)).toEqual(['safe', 'suggestive']);
  });
  test('without the filter it is the level', () => {
    expect(searchRatings('all', false)).toEqual(ratingsFor('all'));
  });
});

describe('levelCacheSuffix', () => {
  test('suggestive keeps the keys that held safe + suggestive before #1105; every other level has its own', () => {
    expect(levelCacheSuffix('suggestive')).toBe('');
    expect(levelCacheSuffix('off')).toBe(':r=off');
    expect(levelCacheSuffix('erotica')).toBe(':r=erotica');
    expect(levelCacheSuffix('all')).toBe(':r=all');
  });
});

describe('applyLevelChange: the gate for raising a level', () => {
  const now = '2026-10-24T00:00:00.000Z';
  const none = { ageConfirmedAt: null, tosAcceptedAt: null };
  test('erotica needs the age confirmed, now or before', () => {
    expect(applyLevelChange('erotica', none, {}, now)).toEqual({
      ok: false,
      reason: 'age',
    });
    expect(
      applyLevelChange('erotica', none, { confirmAge: true }, now),
    ).toEqual({
      ok: true,
      level: 'erotica',
      ageConfirmedAt: now,
      tosAcceptedAt: null,
    });
    const confirmed = {
      ageConfirmedAt: '2026-01-01T00:00:00.000Z',
      tosAcceptedAt: null,
    };
    expect(applyLevelChange('erotica', confirmed, {}, now)).toMatchObject({
      ok: true,
      ageConfirmedAt: '2026-01-01T00:00:00.000Z',
    });
  });
  test('all needs the age and the Terms', () => {
    expect(applyLevelChange('all', none, { confirmAge: true }, now)).toEqual({
      ok: false,
      reason: 'tos',
    });
    expect(
      applyLevelChange('all', none, { confirmAge: true, acceptTos: true }, now),
    ).toEqual({
      ok: true,
      level: 'all',
      ageConfirmedAt: now,
      tosAcceptedAt: now,
    });
  });
  test('suggestive needs nothing: it is not 18+', () => {
    expect(applyLevelChange('suggestive', none, {}, now)).toEqual({
      ok: true,
      level: 'suggestive',
      ageConfirmedAt: null,
      tosAcceptedAt: null,
    });
  });
  test('lowering is always allowed and keeps the records', () => {
    const both = { ageConfirmedAt: 'a', tosAcceptedAt: 'b' };
    expect(applyLevelChange('off', both, {}, now)).toEqual({
      ok: true,
      level: 'off',
      ageConfirmedAt: 'a',
      tosAcceptedAt: 'b',
    });
  });
});

describe('ratingScope: what a catalog call fetches, and its cache key', () => {
  test("off is the default scope: today's ratings, today's keys", () => {
    expect(ratingScope('off')).toEqual(OFF_SCOPE);
    expect(ratingScope('off', true)).toEqual(OFF_SCOPE);
  });
  test('the adult-only filter gets its own key', () => {
    expect(ratingScope('erotica', true)).toEqual({
      ratings: ['erotica'],
      key: ':r=erotica:adult',
    });
    expect(ratingScope('all')).toEqual({
      ratings: ratingsFor('all'),
      key: ':r=all',
    });
  });
});
