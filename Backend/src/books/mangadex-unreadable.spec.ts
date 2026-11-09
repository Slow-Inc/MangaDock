/**
 * #1112: MangaDex can still list a title as translated after its chapters were removed (Sousou no Frieren). The home
 * page asks which of its titles have nothing to read: one light feed request per title, cached for a day, and a
 * title whose check fails is never reported.
 */
import { MangaDexService } from './mangadex.service';

type Internals = {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
};

function makeService(
  totals: Record<string, number | 'fail'>,
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
    const id = new URL(url).pathname.split('/')[2];
    const total = totals[id];
    if (total === 'fail')
      return Promise.resolve(new Response('{}', { status: 503 }));
    return Promise.resolve(
      new Response(JSON.stringify({ total, data: [] }), { status: 200 }),
    );
  };
  return { service, urls, store };
}

describe('MangaDexService.findUnreadable (#1112)', () => {
  it('reports the titles whose chapter feed is empty, asking one light page per title', async () => {
    const { service, urls } = makeService({ a: 48, b: 0, c: 3 });
    await expect(service.findUnreadable(['a', 'b', 'c'])).resolves.toEqual(
      new Set(['b']),
    );
    expect(urls).toHaveLength(3);
    const q = new URL(urls[0]).searchParams;
    expect(q.get('limit')).toBe('1');
    expect(q.getAll('translatedLanguage[]')).toEqual(['th', 'en']);
    expect(q.getAll('contentRating[]')).toEqual([
      'safe',
      'suggestive',
      'erotica',
      'pornographic',
    ]);
  });

  it('caches each answer, so the next build asks nothing', async () => {
    const { service, urls } = makeService({ a: 48, b: 0 });
    await service.findUnreadable(['a', 'b']);
    urls.length = 0;
    await expect(service.findUnreadable(['a', 'b'])).resolves.toEqual(
      new Set(['b']),
    );
    expect(urls).toHaveLength(0);
  });

  it('never reports a title whose check failed, and does not cache it', async () => {
    const { service, store } = makeService({ a: 'fail', b: 0 });
    await expect(service.findUnreadable(['a', 'b'])).resolves.toEqual(
      new Set(['b']),
    );
    expect(Object.keys(store).some((k) => k.endsWith(':a'))).toBe(false);
  });

  it('asks once per title even when it appears in several rows', async () => {
    const { service, urls } = makeService({ a: 0 });
    await service.findUnreadable(['a', 'a', 'a']);
    expect(urls).toHaveLength(1);
  });
});
