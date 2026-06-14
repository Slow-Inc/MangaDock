import { BooksService } from './books.service';

function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { put: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(undefined) };
  const service = new BooksService(
    {} as any,
    cache as any,
    { enabled: false } as any,
    {} as any,
    storage as any,
  );
  return { service };
}

function mockFetchCapturingMitConfig(): { getConfig: () => any } {
  let capturedConfig: any = null;
  jest.spyOn(global, 'fetch').mockImplementation(async (url: any, options?: any) => {
    if (String(url).includes('/batch')) {
      const form: FormData = options?.body;
      capturedConfig = JSON.parse(form?.get('config') as string ?? 'null');
      return {
        ok: true, status: 202,
        headers: { get: () => 'application/json' },
        json: async () => ({ status: 'accepted' }),
      } as any;
    }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as any;
  });
  return { getConfig: () => capturedConfig };
}

async function runBatch(service: BooksService) {
  await (service as any).batch._runMitBatch(
    'ch1',
    [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }],
    jest.fn(),
    new AbortController().signal,
    'ANY', 'THA', 'ch1:ANY:THA',
  );
}

describe('BooksService — MIT translator config', () => {
  afterEach(() => jest.restoreAllMocks());

  // Cycle B7 — Backend does not dictate which translator MIT uses
  it('does not include translator.translator in the config sent to MIT', async () => {
    const { service } = makeService();
    const { getConfig } = mockFetchCapturingMitConfig();

    await runBatch(service);

    expect(getConfig()?.translator?.translator).toBeUndefined();
  });

  // Cycle B8 — Backend still sends target_lang so MIT knows what language to translate to
  it('includes target_lang in the translator config sent to MIT', async () => {
    const { service } = makeService();
    const { getConfig } = mockFetchCapturingMitConfig();

    await runBatch(service);

    expect(getConfig()?.translator?.target_lang).toBe('THA');
  });
});
