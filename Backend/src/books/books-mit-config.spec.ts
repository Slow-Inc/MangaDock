import { BooksService } from './books.service';

/**
 * buildMitConfig is the single source of truth for the MIT pipeline config used
 * by both the single-page and batch translate paths. It defaults the heavy
 * detection/inpainting resolutions down from MIT's quality-tuned bundled values
 * and exposes them (plus inpainter + precision) as env knobs for per-GPU tuning.
 */
function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { put: jest.fn().mockResolvedValue(undefined), list: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(undefined) };
  return new BooksService({} as any, cache as any, { enabled: false } as any, {} as any, storage as any);
}

const ENV_KEYS = [
  'MIT_DETECTION_SIZE',
  'MIT_INPAINTING_SIZE',
  'MIT_INPAINTER',
  'MIT_INPAINTING_PRECISION',
];

describe('BooksService.buildMitConfig', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; }));
  afterEach(() => ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }));

  it('uses conservative resolution + bf16 + lama_large by default', () => {
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('JPN', 'THA', 'ja'));
    expect(cfg.detector.detection_size).toBe(2048);
    expect(cfg.inpainter.inpainting_size).toBe(1536);
    expect(cfg.inpainter.inpainter).toBe('lama_large');
    expect(cfg.inpainter.inpainting_precision).toBe('bf16');
    expect(cfg.translator.target_lang).toBe('THA');
    expect(cfg.translator.source_lang).toBe('JPN');
  });

  it('honors per-GPU env overrides (e.g. a low-VRAM card)', () => {
    process.env.MIT_DETECTION_SIZE = '1536';
    process.env.MIT_INPAINTING_SIZE = '1024';
    process.env.MIT_INPAINTER = 'lama_mpe';
    process.env.MIT_INPAINTING_PRECISION = 'fp16';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.detector.detection_size).toBe(1536);
    expect(cfg.inpainter.inpainting_size).toBe(1024);
    expect(cfg.inpainter.inpainter).toBe('lama_mpe');
    expect(cfg.inpainter.inpainting_precision).toBe('fp16');
  });

  it('ignores invalid size env and falls back to the default', () => {
    process.env.MIT_DETECTION_SIZE = 'not-a-number';
    process.env.MIT_INPAINTING_SIZE = '-5';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.detector.detection_size).toBe(2048);
    expect(cfg.inpainter.inpainting_size).toBe(1536);
  });

  it('omits source_lang when srcMIT is ANY', () => {
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.translator.source_lang).toBeUndefined();
    expect(cfg.translator.source_lang_only).toBeUndefined();
  });
});
