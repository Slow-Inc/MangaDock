import { fetchProxiedImage } from './img-proxy.helper';

const VALID_URL = 'https://uploads.mangadex.org/covers/abc/cover.jpg';

function makeFetch(opts: {
  status?: number;
  contentType?: string;
  contentLength?: string;
  body?: ReadableStream<Uint8Array> | null;
  throws?: Error;
}): typeof fetch {
  return () => {
    if (opts.throws) return Promise.reject(opts.throws);
    const headers = new Headers();
    if (opts.contentType) headers.set('content-type', opts.contentType);
    if (opts.contentLength) headers.set('content-length', opts.contentLength);
    return Promise.resolve({
      status: opts.status ?? 200,
      headers,
      body: opts.body !== undefined ? opts.body : new ReadableStream(),
    } as unknown as Response);
  };
}

describe('fetchProxiedImage', () => {
  describe('URL validation', () => {
    test('empty url → 400', async () => {
      const result = await fetchProxiedImage(
        '',
        15_000_000,
        10_000,
        makeFetch({}),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.httpStatus).toBe(400);
    });

    test('http:// url → 400', async () => {
      const result = await fetchProxiedImage(
        'http://evil.com/img.jpg',
        15_000_000,
        10_000,
        makeFetch({}),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.httpStatus).toBe(400);
    });
  });

  describe('timeout', () => {
    test('AbortError from fetch → 504', async () => {
      const abortErr = Object.assign(new Error('aborted'), {
        name: 'AbortError',
      });
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({ throws: abortErr }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.httpStatus).toBe(504);
    });
  });

  describe('size cap', () => {
    test('Content-Length > maxBytes → 413', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        1024,
        10_000,
        makeFetch({ contentLength: '2048' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.httpStatus).toBe(413);
    });

    test('Content-Length === maxBytes → ok (boundary included)', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        1024,
        10_000,
        makeFetch({ contentLength: '1024' }),
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('successful fetch', () => {
    test('returns ok with contentType from upstream', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({ contentType: 'image/webp' }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.contentType).toBe('image/webp');
    });

    test('defaults contentType to image/jpeg when missing', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({}),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.contentType).toBe('image/jpeg');
    });

    test('passes contentLength through when present', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({ contentLength: '512000' }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.contentLength).toBe(512000);
    });

    test('contentLength is null when not in upstream headers', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({}),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.contentLength).toBeNull();
    });

    test('no-body upstream → 502', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({ body: null }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.httpStatus).toBe(502);
    });

    test('generic network error → 502', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({ throws: new Error('ECONNREFUSED') }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.httpStatus).toBe(502);
    });
  });

  // Regression: MangaDex returns 400 + an HTML error page (its SPA shell) for
  // blocked/hotlinked requests. The proxy must NOT forward that as a "successful"
  // image, or next/image renders "The requested resource isn't a valid image".
  describe('upstream rejection (non-2xx or non-image)', () => {
    test('upstream non-2xx status → ok:false 502 (not forwarded as an image)', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({ status: 400, contentType: 'text/html' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.httpStatus).toBe(502);
    });

    test('upstream 200 but non-image content-type → ok:false 502', async () => {
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        makeFetch({ status: 200, contentType: 'text/html; charset=utf-8' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.httpStatus).toBe(502);
    });
  });

  describe('upstream request headers', () => {
    test('sends a User-Agent MangaDex does not block (no "Mozilla/5.0 (compatible;" bot pattern)', async () => {
      let sentUA = '';
      const captureFetch = ((
        _url: unknown,
        init?: { headers?: Record<string, string> },
      ) => {
        sentUA = init?.headers?.['User-Agent'] ?? '';
        const headers = new Headers();
        headers.set('content-type', 'image/jpeg');
        return Promise.resolve({
          status: 200,
          headers,
          body: new ReadableStream(),
        } as unknown as Response);
      }) as unknown as typeof fetch;
      const result = await fetchProxiedImage(
        VALID_URL,
        15_000_000,
        10_000,
        captureFetch,
      );
      expect(result.ok).toBe(true);
      expect(sentUA).toBe('MangaDock/1.0 (+https://2552667.xyz)');
      expect(sentUA).not.toMatch(/Mozilla\/5\.0 \(compatible;/);
    });
  });
});
