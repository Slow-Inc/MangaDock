import { BooksService, parseJobKey } from './books.service';

describe('parseJobKey', () => {
  it('round-trips a plain chapterId', () => {
    expect(parseJobKey('abc123:JPN:THA:default:hd')).toEqual({
      chapterId: 'abc123', srcMIT: 'JPN', tgtMIT: 'THA', model: 'default', derivative: 'hd',
    });
  });

  it('keeps the colon in a "ver:<uuid>" chapterId (right-split, #bug-hunt)', () => {
    expect(parseJobKey('ver:752fc515-72ce-4890:ANY:ENG:gemini-2.5-pro:saver')).toEqual({
      chapterId: 'ver:752fc515-72ce-4890',
      srcMIT: 'ANY', tgtMIT: 'ENG', model: 'gemini-2.5-pro', derivative: 'saver',
    });
  });
});

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
  'MIT_OCR_PROB',
  'MIT_TEXT_THRESHOLD',
  'MIT_DET_INVERT',
  'MIT_DET_GAMMA_CORRECT',
  'MIT_BUBBLE_SEG',
  'MIT_FONT_SIZE_OFFSET',
  'MIT_FONT_SIZE_MIN',
  'MIT_BUBBLE_AREA_FIT',
  'MIT_SFX_DETECTOR',
  'MIT_EN_COMIC_FONT',
  'MIT_SUPERSAMPLING',
  'MIT_EN_UPPERCASE',
  'MIT_FONT_MAX_BOX_RATIO',
  'MIT_EN_FONT',
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

  /** #167 rescue knobs — all opt-in; absent env leaves the config
   *  byte-identical to today. MIT_OCR_PROB is the primary lever: the 48px
   *  OCR drops long thin lines it read almost correctly (measured 8/8
   *  detected but 5/8 kept on the reference page). */
  it('exposes the OCR prob floor via MIT_OCR_PROB (#167)', () => {
    process.env.MIT_OCR_PROB = '0.05';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.ocr).toEqual({ prob: 0.05 });
  });

  it('exposes detector rescue knobs via env (#167)', () => {
    process.env.MIT_TEXT_THRESHOLD = '0.3';
    process.env.MIT_DET_INVERT = '1';
    process.env.MIT_DET_GAMMA_CORRECT = '1';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.detector.text_threshold).toBe(0.3);
    expect(cfg.detector.det_invert).toBe(true);
    expect(cfg.detector.det_gamma_correct).toBe(true);
  });

  it('omits all #167 knobs when env is unset or invalid — config unchanged', () => {
    process.env.MIT_OCR_PROB = 'not-a-number';
    process.env.MIT_TEXT_THRESHOLD = '5'; // out of (0,1] range
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.ocr).toBeUndefined();
    expect(cfg.detector).toEqual({ detection_size: 2048 });
  });

  /** #170 bubble segmentation — opt-in; absent env leaves the config
   *  byte-identical (guarded by the "#167 knobs unset" detector-shape test). */
  it('enables bubble segmentation via MIT_BUBBLE_SEG (#170)', () => {
    process.env.MIT_BUBBLE_SEG = '1';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.detector.det_bubble_seg).toBe(true);
  });

  it('omits det_bubble_seg unless MIT_BUBBLE_SEG is exactly "1" (#170)', () => {
    process.env.MIT_BUBBLE_SEG = '0';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.detector.det_bubble_seg).toBeUndefined();
  });

  /** #166 font-size fidelity — the renderer's auto floor is (img.h+img.w)/200,
   *  which in patch mode is computed from the tiny crop → uniformly small text.
   *  Expose the existing MIT render knobs so an operator can raise the floor /
   *  offset; absent env = render block unchanged. */
  it('exposes render font-size knobs via env (#166)', () => {
    process.env.MIT_FONT_SIZE_MIN = '24';
    process.env.MIT_FONT_SIZE_OFFSET = '4';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.render.font_size_minimum).toBe(24);
    expect(cfg.render.font_size_offset).toBe(4);
  });

  it('enables the comic EN font + supersampling via env (#176/#181)', () => {
    process.env.MIT_EN_COMIC_FONT = '1';
    process.env.MIT_SUPERSAMPLING = '4';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'ENG', ''));
    expect(cfg.render.en_comic_font).toBe(true);
    expect(cfg.render.supersampling).toBe(4);
  });

  it('omits en_comic_font + supersampling when env is unset — render unchanged (#176/#181)', () => {
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'ENG', ''));
    expect(cfg.render.en_comic_font).toBeUndefined();
    expect(cfg.render.supersampling).toBeUndefined();
  });

  /** Render-parity gap A (MangaTranslator pipeline.py:1375 `text.upper()`): manga
   *  lettering is ALL-CAPS. The MIT renderer already honors render.uppercase
   *  (manga_translator.py:1125); expose it as an opt-in knob. */
  it('enables ALL-CAPS lettering via MIT_EN_UPPERCASE (#parity-A)', () => {
    process.env.MIT_EN_UPPERCASE = '1';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'ENG', ''));
    expect(cfg.render.uppercase).toBe(true);
  });

  it('omits uppercase when MIT_EN_UPPERCASE is unset — render unchanged (#parity-A)', () => {
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'ENG', ''));
    expect(cfg.render.uppercase).toBeUndefined();
  });

  /** Render-parity gap C: raise the #175 font cap (0.5·balloon height) so text
   *  fills the bubble like MangaTranslator. Fraction in (0,1]; absent → unchanged. */
  it('raises the bubble-fit font cap via MIT_FONT_MAX_BOX_RATIO (#parity-C)', () => {
    process.env.MIT_FONT_MAX_BOX_RATIO = '0.8';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'ENG', ''));
    expect(cfg.render.font_max_box_ratio).toBe(0.8);
  });

  it('omits font_max_box_ratio when unset or out of (0,1] — render unchanged (#parity-C)', () => {
    process.env.MIT_FONT_MAX_BOX_RATIO = '1.5'; // out of range
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'ENG', ''));
    expect(cfg.render.font_max_box_ratio).toBeUndefined();
  });

  /** Render-parity gap B: override the EN face by filename (MangaTranslator BYO
   *  font) for a heavier comic weight. Absent → unchanged. */
  it('overrides the EN font via MIT_EN_FONT (#parity-B)', () => {
    process.env.MIT_EN_FONT = 'anime_ace_3.ttf';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'ENG', ''));
    expect(cfg.render.en_font).toBe('anime_ace_3.ttf');
  });

  it('omits en_font when MIT_EN_FONT is unset — render unchanged (#parity-B)', () => {
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'ENG', ''));
    expect(cfg.render.en_font).toBeUndefined();
  });

  it('omits render font-size knobs when unset — render block unchanged (#166)', () => {
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.render.font_size_minimum).toBeUndefined();
    expect(cfg.render.font_size_offset).toBeUndefined();
  });

  it('enables bubble area-fit font sizing via MIT_BUBBLE_AREA_FIT (#166)', () => {
    process.env.MIT_BUBBLE_AREA_FIT = '1';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.render.bubble_area_fit).toBe(true);
  });

  it('omits bubble_area_fit unless MIT_BUBBLE_AREA_FIT is "1" (#166)', () => {
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.render.bubble_area_fit).toBeUndefined();
  });

  it('enables the SFX detector via MIT_SFX_DETECTOR (#168)', () => {
    process.env.MIT_SFX_DETECTOR = '1';
    const svc = makeService();
    const cfg = JSON.parse((svc as any).buildMitConfig('ANY', 'THA', ''));
    expect(cfg.detector.det_sfx).toBe(true);
  });

  it('carries series_context to the translator when provided (#157)', () => {
    const svc = makeService();
    const cfg = JSON.parse(
      (svc as any).buildMitConfig('ANY', 'THA', '', undefined, 'You are translating the manga series "Mob Seka".'),
    );
    expect(cfg.translator.series_context).toBe('You are translating the manga series "Mob Seka".');
  });

  it('produces a byte-identical config when series_context is absent (local-first rule)', () => {
    const svc = makeService();
    const withUndefined = (svc as any).buildMitConfig('JPN', 'THA', 'ja', undefined, undefined);
    const legacyCall = (svc as any).buildMitConfig('JPN', 'THA', 'ja');
    expect(withUndefined).toBe(legacyCall);
    expect(withUndefined).not.toContain('series_context');
  });
});
