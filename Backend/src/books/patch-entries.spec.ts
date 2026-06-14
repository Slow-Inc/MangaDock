import { toPatchEntries } from './books.service';

/**
 * #232: `toPatchEntries` is the single source of truth for the raw-MIT-patch →
 * percent-geometry math that was previously triplicated across the single-page,
 * batch-stream, and webhook delivery paths. Pure — pinned here with zero mocks
 * so the three call sites provably produce identical entries for a given input.
 */
describe('toPatchEntries (#232)', () => {
  it('maps rects to percent geometry aligned with their stored urls', () => {
    const rects = [
      { x: 10, y: 20, w: 30, h: 40 },
      { x: 50, y: 60, w: 5, h: 5 },
    ];
    const urls = ['http://b/p0.png', 'http://b/p1.png'];
    expect(toPatchEntries(rects, urls, 100, 200)).toEqual([
      { xPct: 0.1, yPct: 0.1, wPct: 0.3, hPct: 0.2, url: 'http://b/p0.png' },
      { xPct: 0.5, yPct: 0.3, wPct: 0.05, hPct: 0.025, url: 'http://b/p1.png' },
    ]);
  });

  it('degrades a zero image dimension to 0 on that axis only', () => {
    expect(
      toPatchEntries([{ x: 10, y: 20, w: 30, h: 40 }], ['u'], 0, 200),
    ).toEqual([{ xPct: 0, yPct: 0.1, wPct: 0, hPct: 0.2, url: 'u' }]);
  });

  it('returns an empty array for no rects', () => {
    expect(toPatchEntries([], [], 100, 200)).toEqual([]);
  });

  it('reads only x/y/w/h — works structurally for {…,buf} and {…,img_b64} raw shapes', () => {
    const withExtra = [{ x: 1, y: 2, w: 3, h: 4, img_b64: 'AA==' }];
    expect(toPatchEntries(withExtra, ['u'], 10, 10)).toEqual([
      { xPct: 0.1, yPct: 0.2, wPct: 0.3, hPct: 0.4, url: 'u' },
    ]);
  });
});
