import { MitClient } from './mit-client';

/**
 * #230: MitClient is the single HTTP boundary to the manga-image-translator
 * server. These tests pin the exact URL + method + body each method issues
 * (the contract BooksService relied on inline before the extraction) by faking
 * global.fetch — the fakeable boundary that makes the translation subsystem
 * unit-testable for the first time.
 */
describe('MitClient (#230)', () => {
  const realFetch = global.fetch;
  const savedUrl = process.env.MANGA_TRANSLATOR_URL;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.MANGA_TRANSLATOR_URL;
  });
  afterEach(() => {
    global.fetch = realFetch;
    if (savedUrl === undefined) delete process.env.MANGA_TRANSLATOR_URL;
    else process.env.MANGA_TRANSLATOR_URL = savedUrl;
  });

  it('defaults the base URL to http://localhost:5003 and exposes it', () => {
    expect(new MitClient().baseUrl).toBe('http://localhost:5003');
  });

  it('resolves MANGA_TRANSLATOR_URL in one place', () => {
    process.env.MANGA_TRANSLATOR_URL = 'http://mit:9999';
    expect(new MitClient().baseUrl).toBe('http://mit:9999');
  });

  it('ready() GETs /ready with an abort signal', async () => {
    await new MitClient().ready(3000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:5003/ready');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('submitSinglePage() POSTs the form to /translate/with-form/patches with a signal', async () => {
    const form = new FormData();
    await new MitClient().submitSinglePage(form, 300_000);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:5003/translate/with-form/patches');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('submitBatch() POSTs the form to /translate/with-form/patches/batch with NO signal', async () => {
    const form = new FormData();
    await new MitClient().submitBatch(form);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:5003/translate/with-form/patches/batch');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect(init.signal).toBeUndefined();
  });

  it('cancel() POSTs to /cancel/:jobKey with the key URI-encoded', async () => {
    await new MitClient().cancel('ver:abc:JPN:THA:default:hd');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'http://localhost:5003/cancel/ver%3Aabc%3AJPN%3ATHA%3Adefault%3Ahd',
    );
    expect(init.method).toBe('POST');
  });
});
