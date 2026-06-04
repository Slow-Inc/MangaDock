import { BooksService } from './books.service';

function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { put: jest.fn().mockResolvedValue(undefined) };
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
  await (service as any)._runMitBatch(
    'ch1',
    [{ pageIndex: 0, pageUrl: 'http://example.com/0.jpg' }],
    jest.fn(),
    new AbortController().signal,
    'ANY', 'THA', 'ch1:ANY:THA',
  );
}

describe('BooksService — MIT_TRANSLATOR env var (#93)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MIT_TRANSLATOR;
    delete process.env.MIT_TRANSLATOR_TYPE;
    delete process.env.MIT_API_TRANSLATOR;
    delete process.env.MIT_LOCAL_TRANSLATOR;
  });

  // Cycle B1 — default: no MIT_TRANSLATOR → sends 'gemini'
  it('sends translator: gemini by default when MIT_TRANSLATOR is not set', async () => {
    const { service } = makeService();
    const { getConfig } = mockFetchCapturingMitConfig();

    await runBatch(service);

    expect(getConfig()?.translator?.translator).toBe('gemini');
  });

  // Cycle B2 — MIT_TRANSLATOR=qwen3 → sends 'qwen3' (backward compat)
  it('sends translator: qwen3 when MIT_TRANSLATOR=qwen3', async () => {
    process.env.MIT_TRANSLATOR = 'qwen3';
    const { service } = makeService();
    const { getConfig } = mockFetchCapturingMitConfig();

    await runBatch(service);

    expect(getConfig()?.translator?.translator).toBe('qwen3');
  });

  // Cycle B3 — MIT_TRANSLATOR_TYPE=local, no model set → default 'qwen3'
  it('sends translator: qwen3 (default local) when MIT_TRANSLATOR_TYPE=local and no model specified', async () => {
    process.env.MIT_TRANSLATOR_TYPE = 'local';
    const { service } = makeService();
    const { getConfig } = mockFetchCapturingMitConfig();

    await runBatch(service);

    expect(getConfig()?.translator?.translator).toBe('qwen3');
  });

  // Cycle B4 — MIT_TRANSLATOR_TYPE=local + MIT_LOCAL_TRANSLATOR=nllb → 'nllb'
  it('sends translator: nllb when MIT_TRANSLATOR_TYPE=local and MIT_LOCAL_TRANSLATOR=nllb', async () => {
    process.env.MIT_TRANSLATOR_TYPE = 'local';
    process.env.MIT_LOCAL_TRANSLATOR = 'nllb';
    const { service } = makeService();
    const { getConfig } = mockFetchCapturingMitConfig();

    await runBatch(service);

    expect(getConfig()?.translator?.translator).toBe('nllb');
  });

  // Cycle B5 — MIT_TRANSLATOR_TYPE=api + MIT_API_TRANSLATOR=deepseek → 'deepseek'
  it('sends translator: deepseek when MIT_TRANSLATOR_TYPE=api and MIT_API_TRANSLATOR=deepseek', async () => {
    process.env.MIT_TRANSLATOR_TYPE = 'api';
    process.env.MIT_API_TRANSLATOR = 'deepseek';
    const { service } = makeService();
    const { getConfig } = mockFetchCapturingMitConfig();

    await runBatch(service);

    expect(getConfig()?.translator?.translator).toBe('deepseek');
  });

  // Cycle B6 — MIT_TRANSLATOR_TYPE=api, no model set → default 'gemini'
  it('sends translator: gemini (default api) when MIT_TRANSLATOR_TYPE=api and no model specified', async () => {
    process.env.MIT_TRANSLATOR_TYPE = 'api';
    const { service } = makeService();
    const { getConfig } = mockFetchCapturingMitConfig();

    await runBatch(service);

    expect(getConfig()?.translator?.translator).toBe('gemini');
  });
});
