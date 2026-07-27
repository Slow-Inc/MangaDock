import { BooksController } from './books.controller';
import { StatsIncrementService } from '../cache/stats-increment.service';

function makeBooks(pages: string[] | null = ['url1']) {
  return {
    getMangaChapterPages: jest
      .fn()
      .mockResolvedValue(pages ? { pages, dataSaverPages: [] } : null),
  };
}

function makeStats() {
  return { recordChapterView: jest.fn().mockResolvedValue(undefined) };
}

function makeController(books = makeBooks(), stats = makeStats()) {
  return {
    ctrl: new BooksController(
      books as any,
      stats as unknown as StatsIncrementService,
    ),
    books,
    stats,
  };
}

describe('BooksController — stats wiring', () => {
  afterEach(() => jest.restoreAllMocks());

  // Cycle 1 — records view when chapter pages are returned
  it('getMangaChapterPages records a chapter view when result is non-null', async () => {
    const { ctrl, stats } = makeController();
    const req = { headers: { 'x-hardware-id': 'hw-abc' } };

    await ctrl.getMangaChapterPages('ch:1', 'manga:A', req as any);

    expect(stats.recordChapterView).toHaveBeenCalledWith(
      'ch:1',
      'manga:A',
      'hw-abc',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  // Cycle 2 — no recording when chapter not found
  it('getMangaChapterPages does not record a view when result is null', async () => {
    const { ctrl, stats } = makeController(makeBooks(null));
    const req = { headers: { 'x-hardware-id': 'hw-abc' } };

    await expect(
      ctrl.getMangaChapterPages('ch:1', 'manga:A', req as any),
    ).rejects.toThrow();
    expect(stats.recordChapterView).not.toHaveBeenCalled();
  });

  // Cycle 3 — missing HWID falls back to 'anon'
  it('getMangaChapterPages uses "anon" uid when x-hardware-id header is absent', async () => {
    const { ctrl, stats } = makeController();
    const req = { headers: {} };

    await ctrl.getMangaChapterPages('ch:1', 'manga:A', req as any);

    expect(stats.recordChapterView).toHaveBeenCalledWith(
      'ch:1',
      'manga:A',
      'anon',
      expect.any(String),
    );
  });
});
