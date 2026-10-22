/**
 * #958: any non-2xx MangaDex answer was broadcast to every SSE client as "MangaDex offline" — including a 400 caused
 * by one client's bad query (`?limit=abc`). A 4xx (other than 429) is our own bad request, not an outage.
 */
import { MangaDexService } from './mangadex.service';

type Internals = {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  fetchMangaWithParamsPaged(
    params: URLSearchParams,
    label: string,
  ): Promise<{ items: unknown[]; total: number }>;
};

function makeService(status: number) {
  const broadcastStatus = jest.fn();
  const service = new MangaDexService(
    {} as never,
    {} as never,
    { broadcastStatus } as never,
  ) as unknown as Internals;
  service.fetchFn = () =>
    Promise.resolve(new Response('{"result":"error"}', { status }));
  return { service, broadcastStatus };
}

describe('MangaDexService — which failures are an outage (#958)', () => {
  it('a 400 (our own bad request) does not tell every user MangaDex is offline', async () => {
    const { service, broadcastStatus } = makeService(400);
    const res = await service.fetchMangaWithParamsPaged(
      new URLSearchParams(),
      'test',
    );
    expect(res).toEqual({ items: [], total: 0 });
    expect(broadcastStatus).not.toHaveBeenCalledWith('mangadex', 'offline');
  });

  it('a 503 is still an outage', async () => {
    const { service, broadcastStatus } = makeService(503);
    await service.fetchMangaWithParamsPaged(new URLSearchParams(), 'test');
    expect(broadcastStatus).toHaveBeenCalledWith('mangadex', 'offline');
  });

  it('a 429 (rate limited) is still reported as unavailable', async () => {
    const { service, broadcastStatus } = makeService(429);
    await service.fetchMangaWithParamsPaged(new URLSearchParams(), 'test');
    expect(broadcastStatus).toHaveBeenCalledWith('mangadex', 'offline');
  });

  it('a 403 (MangaDex or its CDN blocking us) is an outage too', async () => {
    const { service, broadcastStatus } = makeService(403);
    await service.fetchMangaWithParamsPaged(new URLSearchParams(), 'test');
    expect(broadcastStatus).toHaveBeenCalledWith('mangadex', 'offline');
  });

  it('reports at most the 10,000 results MangaDex can page to', async () => {
    const broadcastStatus = jest.fn();
    const service = new MangaDexService(
      {} as never,
      {} as never,
      { broadcastStatus } as never,
    ) as unknown as Internals;
    service.fetchFn = () =>
      Promise.resolve(
        new Response(JSON.stringify({ data: [], total: 54321 }), {
          status: 200,
        }),
      );
    const res = await service.fetchMangaWithParamsPaged(
      new URLSearchParams(),
      'test',
    );
    expect(res.total).toBe(10000);
  });
});
