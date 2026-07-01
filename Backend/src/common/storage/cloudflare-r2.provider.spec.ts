import { Readable } from 'stream';
import { CloudflareR2StorageProvider } from './cloudflare-r2.provider';

// FR-22: the R2 provider must stream PUT/GET object bodies through to the
// worker instead of double-buffering the whole object into memory first.
// These tests assert the *streaming* behavior at the fetch boundary: PUT hands
// the source stream straight to fetch (never draining it into a Buffer), and
// getStream returns a live Readable over the response body.
describe('CloudflareR2StorageProvider streaming (FR-22)', () => {
  let provider: CloudflareR2StorageProvider;
  let fetchMock: jest.Mock;
  const realFetch = global.fetch;

  beforeEach(() => {
    provider = new CloudflareR2StorageProvider('https://worker.example', 'secret');
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  const okResponse = () =>
    ({ ok: true, status: 200, text: async () => '' }) as unknown as Response;

  it('put streams a Readable straight through to fetch (no buffering)', async () => {
    fetchMock.mockResolvedValue(okResponse());
    const source = Readable.from([Buffer.from('a'), Buffer.from('b')]);

    await provider.put('uploads/x.bin', source, { contentType: 'image/png' });

    const init = fetchMock.mock.calls[0][1] as RequestInit & { duplex?: string };
    // The exact stream instance is handed to fetch — not a materialized Buffer.
    expect(init.body).toBe(source);
    expect(init.body).not.toBeInstanceOf(Uint8Array);
    // Node/undici require duplex:'half' when the request body is a stream.
    expect(init.duplex).toBe('half');
    // The provider must not have drained the stream itself.
    expect(source.readableEnded).toBe(false);
  });

  it('put passes a Buffer through without an extra copy', async () => {
    fetchMock.mockResolvedValue(okResponse());
    const buf = Buffer.from('hello');

    await provider.put('uploads/y.bin', buf);

    const init = fetchMock.mock.calls[0][1] as RequestInit & { duplex?: string };
    expect(init.body).toBe(buf);
    expect(init.duplex).toBeUndefined();
  });

  it('put throws on a non-ok worker response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    } as unknown as Response);

    await expect(provider.put('uploads/z.bin', Buffer.from('x'))).rejects.toThrow(
      'R2 put failed [500]',
    );
  });

  it('getStream returns a live Readable over the response body', async () => {
    const webBody = Readable.toWeb(Readable.from([Buffer.from('hello '), Buffer.from('world')]));
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: webBody,
    } as unknown as Response);

    const stream = await provider.getStream('uploads/a.txt');
    expect(stream).toBeInstanceOf(Readable);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as ArrayBufferLike));
    }
    expect(Buffer.concat(chunks).toString()).toBe('hello world');
  });

  it('getStream throws on a non-ok worker response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
    } as unknown as Response);

    await expect(provider.getStream('uploads/missing.txt')).rejects.toThrow(
      'R2 get failed [404]',
    );
  });
});
