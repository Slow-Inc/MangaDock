import { describe, expect, test } from 'bun:test';
import { createGithubCache, type UpstreamResponse } from './githubCache';

function res(status: number, body = '', etag: string | null = null): UpstreamResponse {
  return { status, ok: status >= 200 && status < 300, headers: { get: n => (n.toLowerCase() === 'etag' ? etag : null) }, text: async () => body };
}

/** A GitHub that answers from a script and records every call. */
function setup(script: Array<UpstreamResponse | Error>, freshMs = 1000) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  let t = 0;
  const cache = createGithubCache({
    freshMs,
    now: () => t,
    fetchUpstream: async (url, headers) => {
      calls.push({ url, headers });
      const next = script.shift();
      if (!next) throw new Error('unscripted call');
      if (next instanceof Error) throw next;
      return next;
    },
  });
  return { cache, calls, advance: (ms: number) => { t += ms; } };
}

describe('githubCache', () => {
  test('serves a fresh entry from memory without calling GitHub', async () => {
    const { cache, calls } = setup([res(200, '[1]', '"a"')]);
    expect((await cache.get('u')).cache).toBe('miss');
    const again = await cache.get('u');
    expect(again).toEqual({ status: 200, body: '[1]', cache: 'hit' });
    expect(calls.length).toBe(1);
  });

  test('a stale entry is revalidated with If-None-Match; 304 renews it', async () => {
    const { cache, calls, advance } = setup([res(200, '[1]', '"a"'), res(304)]);
    await cache.get('u');
    advance(1500);
    const r = await cache.get('u');
    expect(r).toEqual({ status: 200, body: '[1]', cache: 'revalidated' });
    expect(calls[1].headers['If-None-Match']).toBe('"a"');
    advance(500); // renewed at t=1500, so still fresh
    expect((await cache.get('u')).cache).toBe('hit');
    expect(calls.length).toBe(2);
  });

  test('a changed entry replaces the old one', async () => {
    const { cache, advance } = setup([res(200, 'old', '"a"'), res(200, 'new', '"b"')]);
    await cache.get('u');
    advance(1500);
    expect((await cache.get('u')).body).toBe('new');
  });

  test('when GitHub fails (rate limit or network) the stale copy is served, not the error', async () => {
    const { cache, advance } = setup([res(200, 'kept', '"a"'), res(403, '{"message":"rate limit"}'), new Error('down')]);
    await cache.get('u');
    advance(1500);
    expect(await cache.get('u')).toEqual({ status: 200, body: 'kept', cache: 'stale' });
    advance(1500);
    expect((await cache.get('u')).cache).toBe('stale');
  });

  test('after a failure the old copy is served for a while without asking GitHub again', async () => {
    const { cache, calls, advance } = setup([res(200, 'kept', '"a"'), res(403, 'limited'), res(200, 'fresh', '"b"')]);
    await cache.get('u');
    advance(1500);
    expect((await cache.get('u')).cache).toBe('stale'); // asked once, failed
    advance(10_000);
    expect((await cache.get('u')).cache).toBe('stale'); // inside the back-off: not asked
    expect(calls.length).toBe(2);
    advance(30_000);
    expect(await cache.get('u')).toEqual({ status: 200, body: 'fresh', cache: 'miss' }); // asked again
    expect(calls.length).toBe(3);
  });

  test('a 404 or 410 is an answer about the resource: the old copy is dropped and the status passes through', async () => {
    const { cache, advance } = setup([res(200, 'was here', '"a"'), res(404, '{"message":"Not Found"}'), res(200, 'back', '"b"')]);
    await cache.get('u');
    advance(1500);
    const gone = await cache.get('u');
    expect([gone.status, gone.cache]).toEqual([404, 'error']);
    expect((await cache.get('u')).cache).toBe('miss'); // nothing left to serve; asked again
  });

  test('with nothing cached an error keeps its status and is not remembered', async () => {
    const { cache, calls } = setup([res(403, '{"message":"rate limit"}'), res(200, '[2]', '"b"')]);
    const first = await cache.get('u');
    expect(first.status).toBe(403);
    expect(first.cache).toBe('error');
    expect((await cache.get('u')).cache).toBe('miss'); // asked again, not served from memory
    expect(calls.length).toBe(2);
  });

  test('a network failure with nothing cached is a 502', async () => {
    const { cache } = setup([new Error('down')]);
    expect((await cache.get('u')).status).toBe(502);
  });

  test('concurrent readers of one URL share a single upstream call', async () => {
    const { cache, calls } = setup([res(200, 'x', '"a"')]);
    const all = await Promise.all([cache.get('u'), cache.get('u'), cache.get('u')]);
    expect(calls.length).toBe(1);
    expect(all.every(r => r.body === 'x')).toBe(true);
  });

  test('keeps at most maxEntries, dropping the oldest', async () => {
    let n = 0;
    const cache = createGithubCache({ maxEntries: 2, fetchUpstream: async () => res(200, String(n++), null) });
    await cache.get('a'); await cache.get('b'); await cache.get('c');
    expect(cache.size()).toBe(2);
    expect((await cache.get('a')).cache).toBe('miss'); // evicted
  });
});
