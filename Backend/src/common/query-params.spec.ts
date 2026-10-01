import { clampInt, quoteFilterValue } from './query-params';

describe('clampInt', () => {
  it('parses a valid numeric string', () => {
    expect(clampInt('25', 20, 0, 50)).toBe(25);
  });

  it('falls back when the value is missing (#657)', () => {
    expect(clampInt(undefined, 20, 0, 50)).toBe(20);
    expect(clampInt(null, 20, 0, 50)).toBe(20);
    expect(clampInt('', 20, 0, 50)).toBe(20);
  });

  it('falls back instead of producing NaN for non-numeric input (#657)', () => {
    // Regression: `?limit=abc` used to reach `.limit(NaN)` and 500.
    expect(clampInt('abc', 20, 0, 50)).toBe(20);
    expect(Number.isNaN(clampInt('abc', 20, 0, 50))).toBe(false);
  });

  it('floors negatives to min (#657)', () => {
    // Regression: `?offset=-10` used to produce `.range(-10, 9)`.
    expect(clampInt('-10', 0, 0, 1000)).toBe(0);
  });

  it('caps values above max', () => {
    expect(clampInt('9999', 20, 0, 50)).toBe(50);
  });

  it('truncates floats', () => {
    expect(clampInt('3.7', 20, 0, 50)).toBe(3);
  });

  it('accepts a number as-is', () => {
    expect(clampInt(7, 20, 0, 50)).toBe(7);
  });
});

describe('quoteFilterValue', () => {
  it('wraps the value in double quotes', () => {
    expect(quoteFilterValue('%naruto%')).toBe('"%naruto%"');
  });

  it('neutralises an injected .or() clause (#660)', () => {
    // Regression: `q=a,title_id.not.is.null` used to add a top-level OR clause
    // that returned the entire published catalog.
    const quoted = quoteFilterValue('%a,title_id.not.is.null%');
    expect(quoted).toBe('"%a,title_id.not.is.null%"');
    expect(quoted.startsWith('"')).toBe(true);
    expect(quoted.endsWith('"')).toBe(true);
  });

  it('escapes embedded quotes and backslashes so the quoting cannot be closed early', () => {
    expect(quoteFilterValue('%a"b%')).toBe('"%a\\"b%"');
    expect(quoteFilterValue('%a\\b%')).toBe('"%a\\\\b%"');
    expect(quoteFilterValue('%a\\"%')).toBe('"%a\\\\\\"%"');
  });
});
