/**
 * #958: the public book endpoints passed parseInt(...) straight to the service — `?limit=abc` became NaN and
 * `?limit=100000` / `?page=-1` went through unbounded.
 */
import { BooksController } from './books.controller';
import {
  OFF_SCOPE,
  ratingScope,
  type ContentLevel,
} from '../common/content-rating';

function makeController(level: ContentLevel = 'off') {
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
    controller: new BooksController(
      booksService as never,
      {} as never,
      {
        getLevel: (uid?: string) => Promise.resolve(uid ? level : 'off'),
      } as never,
    ),
    calls,
  };
}

const anon = {} as never;

describe('BooksController — numeric query params (#958)', () => {
  it('new-releases: junk falls back, huge and negative values are clamped', async () => {
    const { controller, calls } = makeController();
    await controller.getNewReleases(anon, '-3', 'abc');
    expect(calls.getNewReleases.slice(0, 2)).toEqual([1, 35]);
    await controller.getNewReleases(anon, '2', '100000');
    expect(calls.getNewReleases.slice(0, 2)).toEqual([2, 100]);
  });

  it('genre: never NaN', async () => {
    const { controller, calls } = makeController();
    await controller.getGenreManga(anon, 'action', 'abc', 'abc');
    expect(calls.getGenreManga).toEqual(['action', 1, 28, OFF_SCOPE]);
  });

  it('search: limit and offset clamped, junk years dropped', async () => {
    const { controller, calls } = makeController();
    await controller.searchBooks(
      anon,
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

describe('BooksController — 18+ ratings come from the stored level, not the request (#1101)', () => {
  const signedIn = { uid: 'u1' } as never;

  it('anonymous callers get off, even when they ask for adult=only', async () => {
    const { controller, calls } = makeController('all');
    await controller.searchBooks(
      anon,
      'q',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'only',
    );
    expect(calls.searchBooks.at(-1)).toEqual(OFF_SCOPE);
  });

  it("a signed-in caller gets their level's ratings, and adult=only narrows them", async () => {
    const { controller, calls } = makeController('erotica');
    await controller.getGenreManga(signedIn, 'action');
    expect(calls.getGenreManga.at(-1)).toEqual(ratingScope('erotica'));
    await controller.searchBooks(
      signedIn,
      'q',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'only',
    );
    expect(calls.searchBooks.at(-1)).toEqual(ratingScope('erotica', true));
  });

  it('a signed-in caller at off cannot widen with adult=only', async () => {
    const { controller, calls } = makeController('off');
    await controller.searchBooks(
      signedIn,
      'q',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'only',
    );
    expect(calls.searchBooks.at(-1)).toEqual(OFF_SCOPE);
  });
});
