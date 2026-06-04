import { BooksService } from './books.service';

// Capture what prompt was sent to Gemini
let capturedPrompt = '';
let generateContentMock = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockImplementation(async (req: any) => {
        capturedPrompt = req?.contents?.[0]?.parts?.[0]?.text ?? '';
        return generateContentMock();
      }),
    }),
  })),
}));

function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BooksService(
    {} as any,
    cache as any,
    { enabled: false } as any,
    {} as any,
    { put: jest.fn() } as any,
  );
  return { service, cache };
}

describe('BooksService — translateMangaEpisode targetLang (#85)', () => {
  beforeEach(() => {
    capturedPrompt = '';
    process.env.GEMINI_API_KEY = 'fake-key';
    generateContentMock = jest.fn().mockResolvedValue({
      response: { text: () => '["translated"]' },
    });
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    jest.clearAllMocks();
  });

  // Cycle 1 — default (no targetLang) keeps Thai
  it('uses Thai when targetLang is omitted', async () => {
    const { service } = makeService();
    await service.translateMangaEpisode({ lines: ['hello'] });
    expect(capturedPrompt).toMatch(/Thai/i);
  });

  // Cycle 2 — targetLang='en' produces English prompt
  it('uses English when targetLang is en', async () => {
    const { service } = makeService();
    await service.translateMangaEpisode({ lines: ['hello'], targetLang: 'en' });
    expect(capturedPrompt).toMatch(/English/i);
    expect(capturedPrompt).not.toMatch(/Thai/i);
  });

  // Cycle 3 — targetLang='ko' produces Korean prompt
  it('uses Korean when targetLang is ko', async () => {
    const { service } = makeService();
    await service.translateMangaEpisode({ lines: ['hello'], targetLang: 'ko' });
    expect(capturedPrompt).toMatch(/Korean/i);
  });

  // Cycle 4 — cache key differs between targetLang values (no cross-language cache hit)
  it('uses different cache keys for different targetLang values', async () => {
    const { service, cache } = makeService();

    await service.translateMangaEpisode({ lines: ['hello'], chapterId: 'ch1', page: 0, targetLang: 'th' });
    const thKey = (cache.setMangaCacheWithTiers.mock.calls[0]?.[0] as string) ?? '';

    cache.setMangaCacheWithTiers.mockClear();

    await service.translateMangaEpisode({ lines: ['hello'], chapterId: 'ch1', page: 0, targetLang: 'en' });
    const enKey = (cache.setMangaCacheWithTiers.mock.calls[0]?.[0] as string) ?? '';

    expect(thKey).toBeTruthy();
    expect(enKey).toBeTruthy();
    expect(thKey).not.toBe(enKey); // different languages → different cache entries
  });

  // Cycle 5 — same targetLang hits cache; different targetLang misses (no cross-language bleed)
  it('same-language second call hits cache; different-language call misses', async () => {
    const { service, cache } = makeService();

    // Stateful cache so writes become readable by subsequent reads
    const store = new Map<string, any>();
    cache.get.mockImplementation(async (key: string) => store.get(key) ?? null);
    cache.setMangaCacheWithTiers.mockImplementation(async (key: string, value: any) => {
      store.set(key, { data: value });
    });

    // First call: English, fills cache
    await service.translateMangaEpisode({ lines: ['hello'], chapterId: 'ch1', page: 0, targetLang: 'en' });
    const callsAfterFirst = generateContentMock.mock.calls.length;
    expect(callsAfterFirst).toBe(1);

    // Second call: same English → cache hit → no new Gemini call
    const second = await service.translateMangaEpisode({ lines: ['hello'], chapterId: 'ch1', page: 0, targetLang: 'en' });
    expect(generateContentMock.mock.calls.length).toBe(1);
    expect(second.fromCache).toBe(1);

    // Third call: Korean → different cache key → Gemini called again
    await service.translateMangaEpisode({ lines: ['hello'], chapterId: 'ch1', page: 0, targetLang: 'ko' });
    expect(generateContentMock.mock.calls.length).toBe(2);
  });
});
