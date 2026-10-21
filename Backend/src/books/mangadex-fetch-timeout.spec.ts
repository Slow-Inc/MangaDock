/**
 * #861: every MangaDex call goes through MangaDexService.mangadexFetch, which had no timeout — a hung
 * MangaDex request held /books/landing (cold cache) for as long as the connection lived. It now aborts.
 */
import { MangaDexService } from './mangadex.service';

function makeService() {
  const service = new MangaDexService({} as any, {} as any, {} as any);
  const seen: RequestInit[] = [];
  // A MangaDex that never answers: only the abort signal ends the request, as with a real hung upstream.
  (service as any).fetchFn = (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      seen.push(init);
      init.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    });
  (service as any).mangadexTimeoutMs = 30;
  return { service, seen };
}

describe('MangaDexService.mangadexFetch — timeout (#861)', () => {
  it('rejects a hung MangaDex request once the timeout passes', async () => {
    const { service } = makeService();
    const started = Date.now();
    await expect((service as any).mangadexFetch('https://api.mangadex.org/manga')).rejects.toBeDefined();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('keeps the MangaDex headers and no-store alongside the signal', async () => {
    const { service, seen } = makeService();
    await (service as any).mangadexFetch('https://api.mangadex.org/manga').catch(() => {});
    expect(seen[0].signal).toBeInstanceOf(AbortSignal);
    expect(seen[0].cache).toBe('no-store');
    expect((seen[0].headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('defaults to a timeout below the frontend server-render budget (8 s)', () => {
    const service = new MangaDexService({} as any, {} as any, {} as any);
    expect((service as any).mangadexTimeoutMs).toBeLessThan(8000);
  });
});
