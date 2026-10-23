/**
 * #1101: the MangaDex requests carry exactly the caller's ratings, and the cache key keeps 18+ results apart.
 */
import { MangaDexService } from './mangadex.service';
import { OFF_SCOPE, ratingScope } from '../common/content-rating';

type Internals = {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
};

const manga = (id: string, contentRating: string) => ({
  id,
  attributes: { title: { en: id }, contentRating },
  relationships: [{ type: 'cover_art', attributes: { fileName: 'c.jpg' } }],
});

function makeService() {
  const urls: string[] = [];
  const keys: string[] = [];
  const cache = {
    get: jest.fn((key: string) => {
      keys.push(key);
      return Promise.resolve(null);
    }),
    set: jest.fn(() => Promise.resolve()),
    getStale: jest.fn(() => null),
  };
  const service = new MangaDexService(
    cache as never,
    { enabled: false } as never,
    { broadcastStatus: jest.fn() } as never,
  );
  (service as unknown as Internals).fetchFn = (url) => {
    urls.push(url);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: [manga('a', 'safe'), manga('b', 'erotica')],
          total: 2,
        }),
        { status: 200 },
      ),
    );
  };
  return { service, urls, keys };
}

const ratingsIn = (url: string) =>
  new URL(url).searchParams.getAll('contentRating[]');

describe('MangaDexService ratings (#1101)', () => {
  it('search asks MangaDex for the scope ratings, and maps contentRating onto the books', async () => {
    const { service, urls } = makeService();
    const { items } = await service.searchManga(
      'q',
      undefined,
      10,
      0,
      undefined,
      ratingScope('all'),
    );
    expect(ratingsIn(urls[0])).toEqual([
      'safe',
      'suggestive',
      'erotica',
      'pornographic',
    ]);
    expect(items.map((b) => b.contentRating)).toEqual(['safe', 'erotica']);
  });

  it('the default (anonymous) scope is safe + suggestive', async () => {
    const { service, urls } = makeService();
    await service.searchManga('q');
    expect(ratingsIn(urls[0])).toEqual(['safe', 'suggestive']);
  });

  it('fetchMangaByIds no longer adds erotica for everyone (the search leak)', async () => {
    const { service, urls } = makeService();
    await service.fetchMangaByIds(['x']);
    expect(ratingsIn(urls[0])).toEqual(['safe', 'suggestive']);
    await service.fetchMangaByIds(['x'], ratingScope('erotica'));
    expect(ratingsIn(urls[1])).toEqual(['safe', 'suggestive', 'erotica']);
  });

  it('genre: the 18+ cache entry is separate from the off one', async () => {
    const { service, keys, urls } = makeService();
    await service.getGenreManga('romance', 1, 28, OFF_SCOPE);
    await service.getGenreManga('romance', 1, 28, ratingScope('erotica', true));
    expect(keys).toEqual([
      'genre:romance:1:28',
      'genre:romance:1:28:r=erotica:adult',
    ]);
    expect(ratingsIn(urls[1])).toEqual(['erotica']);
  });
});
