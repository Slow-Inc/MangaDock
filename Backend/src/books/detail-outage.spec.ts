/**
 * #976: the book detail answered an unknown id and a MangaDex outage alike as "200, empty detail", and cached a detail
 * missing one of its two parts (covers, or title/genres/description) for the full TTL. The browser's #919 split
 * between "ไม่พบข้อมูลหนังสือ" and "โหลดไม่สำเร็จ" never saw a real 404, and kept the empty answer for 30 min.
 */
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MangaDexService } from './mangadex.service';

type Internals = {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const manga = json({
  data: {
    attributes: {
      title: { en: 'Title' },
      description: { en: 'About' },
      tags: [],
    },
    relationships: [{ type: 'author', attributes: { name: 'A' } }],
  },
});
const covers = json({ data: [{ attributes: { volume: '1', fileName: 'f' } }] });

function makeService(
  answer: { manga: () => Response; covers: () => Response },
  stale?: unknown,
) {
  const cache = {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve()),
    getStale: jest.fn(() =>
      stale ? { data: stale, updatedAt: 'then' } : null,
    ),
  };
  const service = new MangaDexService(
    cache as never,
    { enabled: false } as never,
    { broadcastStatus: jest.fn() } as never,
  );
  (service as unknown as Internals).fetchFn = (url) =>
    Promise.resolve(url.includes('/cover?') ? answer.covers() : answer.manga());
  return { service, cache };
}

describe('MangaDexService.getMangaDetail — not found, outage and partial answers (#976)', () => {
  it.each([404, 400])(
    'MangaDex %i for the manga → 404, nothing cached',
    async (status) => {
      const { service, cache } = makeService({
        manga: () => json({}, status),
        covers: () => json({ data: [] }),
      });
      await expect(service.getMangaDetail('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(cache.set).not.toHaveBeenCalled();
    },
  );

  it('the manga fetch is down and nothing is stale → 503, nothing cached', async () => {
    const { service, cache } = makeService({
      manga: () => json({}, 503),
      covers: () => covers.clone(),
    });
    await expect(service.getMangaDetail('x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('the manga fetch is down with a stale detail → the stale detail', async () => {
    const stale = {
      id: 'x',
      title: 'Old',
      authors: [],
      artists: [],
      covers: [],
      genres: [],
      description: '',
    };
    const { service } = makeService(
      { manga: () => json({}, 503), covers: () => covers.clone() },
      stale,
    );
    expect((await service.getMangaDetail('x')).title).toBe('Old');
  });

  it('covers down, manga fine → served without covers, but not cached for the full TTL', async () => {
    const { service, cache } = makeService({
      manga: () => manga.clone(),
      covers: () => json({}, 503),
    });
    const detail = await service.getMangaDetail('x');
    expect(detail.title).toBe('Title');
    expect(detail.covers).toEqual([]);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('covers down with a stale detail → its covers, still not cached', async () => {
    const lastCovers = [{ volume: '1', url: 'https://old/cover.jpg' }];
    const { service, cache } = makeService(
      { manga: () => manga.clone(), covers: () => json({}, 503) },
      { id: 'x', covers: lastCovers },
    );
    const detail = await service.getMangaDetail('x');
    expect(detail.title).toBe('Title');
    expect(detail.covers).toEqual(lastCovers);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('a 200 without the manga (interstitial, changed shape) is an outage, not an empty detail to cache', async () => {
    const { service, cache } = makeService({
      manga: () => json({ result: 'ok' }),
      covers: () => covers.clone(),
    });
    await expect(service.getMangaDetail('x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('both parts fine → cached as before', async () => {
    const { service, cache } = makeService({
      manga: () => manga.clone(),
      covers: () => covers.clone(),
    });
    const detail = await service.getMangaDetail('x');
    expect(detail.covers).toHaveLength(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });
});
