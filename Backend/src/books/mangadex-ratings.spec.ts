/**
 * #1105: the content rating of titles we only know by id (reading history), resolved through MangaDex and cached per
 * title, so history lists can respect the 18+ level.
 */
import { MangaDexService } from './mangadex.service';

type Internals = {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
};

function makeService(
  ratings: Record<string, string>,
  cached: Record<string, unknown> = {},
) {
  const urls: string[] = [];
  const store: Record<string, unknown> = { ...cached };
  const cache = {
    get: jest.fn((key: string) =>
      Promise.resolve(key in store ? { data: store[key] } : null),
    ),
    set: jest.fn((key: string, value: unknown) => {
      store[key] = value;
      return Promise.resolve();
    }),
    getStale: jest.fn(() => null),
  };
  const service = new MangaDexService(
    cache as never,
    { enabled: false } as never,
    { broadcastStatus: jest.fn() } as never,
  );
  (service as unknown as Internals).fetchFn = (url) => {
    urls.push(url);
    const ids = new URL(url).searchParams.getAll('ids[]');
    const data = ids
      .filter((id) => id in ratings)
      .map((id) => ({ id, attributes: { contentRating: ratings[id] } }));
    return Promise.resolve(
      new Response(JSON.stringify({ data }), { status: 200 }),
    );
  };
  return { service, urls, cache };
}

describe('MangaDexService.getContentRatings (#1105)', () => {
  it('asks MangaDex once, for every rating, and returns a map by id', async () => {
    const { service, urls } = makeService({
      a: 'safe',
      b: 'erotica',
      c: 'pornographic',
    });
    await expect(service.getContentRatings(['a', 'b', 'c'])).resolves.toEqual({
      a: 'safe',
      b: 'erotica',
      c: 'pornographic',
    });
    expect(urls).toHaveLength(1);
    expect(new URL(urls[0]).searchParams.getAll('contentRating[]')).toEqual([
      'safe',
      'suggestive',
      'erotica',
      'pornographic',
    ]);
  });

  it('serves cached titles without asking again, and fetches only the rest', async () => {
    const { service, urls } = makeService(
      { b: 'erotica' },
      { 'manga:rating:a': 'safe' },
    );
    await expect(service.getContentRatings(['a', 'b'])).resolves.toEqual({
      a: 'safe',
      b: 'erotica',
    });
    expect(new URL(urls[0]).searchParams.getAll('ids[]')).toEqual(['b']);
  });

  it('an id MangaDex does not return is left out (unknown), not guessed safe', async () => {
    const { service } = makeService({ a: 'safe' });
    await expect(service.getContentRatings(['a', 'zzz'])).resolves.toEqual({
      a: 'safe',
    });
  });

  it('no ids: no request', async () => {
    const { service, urls } = makeService({});
    await expect(service.getContentRatings([])).resolves.toEqual({});
    expect(urls).toHaveLength(0);
  });
});
