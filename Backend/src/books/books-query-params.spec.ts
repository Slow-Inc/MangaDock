/**
 * #958: the public book endpoints passed parseInt(...) straight to the service — `?limit=abc` became NaN and
 * `?limit=100000` / `?page=-1` went through unbounded.
 */
import { BooksController } from './books.controller';

function makeController() {
  const calls: Record<string, unknown[]> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls[name] = args;
      return Promise.resolve({});
    };
  const booksService = {
    getNewReleases: record('getNewReleases'),
    getGenreManga: record('getGenreManga'),
    searchBooks: record('searchBooks'),
    getRelated: record('getRelated'),
  };
  return {
    controller: new BooksController(booksService as never, {} as never),
    calls,
  };
}

describe('BooksController — numeric query params (#958)', () => {
  it('new-releases: junk falls back, huge and negative values are clamped', () => {
    const { controller, calls } = makeController();
    void controller.getNewReleases('-3', 'abc');
    expect(calls.getNewReleases.slice(0, 2)).toEqual([1, 35]);
    void controller.getNewReleases('2', '100000');
    expect(calls.getNewReleases.slice(0, 2)).toEqual([2, 100]);
  });

  it('genre: never NaN', () => {
    const { controller, calls } = makeController();
    void controller.getGenreManga('action', 'abc', 'abc');
    expect(calls.getGenreManga).toEqual(['action', 1, 28]);
  });

  it('search: limit and offset clamped, junk years dropped', () => {
    const { controller, calls } = makeController();
    void controller.searchBooks(
      'q',
      undefined,
      '500',
      '-10',
      undefined,
      'abc',
      '2020',
    );
    const [, , limit, offset, , yearFrom, yearTo] = calls.searchBooks;
    expect([limit, offset, yearFrom, yearTo]).toEqual([
      100,
      0,
      undefined,
      2020,
    ]);
  });

  it('related: bounded to 50', () => {
    const { controller, calls } = makeController();
    void controller.getRelated('id', '999');
    expect(calls.getRelated).toEqual(['id', 50]);
  });
});
