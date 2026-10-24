/**
 * #958: numeric query params reached MangaDex as NaN or unbounded (`?limit=abc`, `?limit=100000`, `?page=-1`).
 */
import { queryInt } from './query-int';

describe('queryInt (#958)', () => {
  it('missing → the fallback', () => {
    expect(queryInt(undefined, 35, { min: 1, max: 100 })).toBe(35);
    expect(queryInt('', 35, { min: 1, max: 100 })).toBe(35);
  });

  it('not a number → the fallback, never NaN', () => {
    expect(queryInt('abc', 35, { min: 1, max: 100 })).toBe(35);
    expect(queryInt('Infinity', 0, { min: 0 })).toBe(0);
  });

  it('a valid integer passes through', () => {
    expect(queryInt('28', 35, { min: 1, max: 100 })).toBe(28);
  });

  it('clamps to the bounds', () => {
    expect(queryInt('100000', 35, { min: 1, max: 100 })).toBe(100);
    expect(queryInt('-1', 1, { min: 1 })).toBe(1);
    expect(queryInt('0', 0, { min: 0 })).toBe(0);
  });

  it('truncates a decimal like parseInt did', () => {
    expect(queryInt('2.9', 1, { min: 1 })).toBe(2);
  });
});
