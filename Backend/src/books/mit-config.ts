import { createHash } from 'crypto';
import { mitLangCode } from './mit-lang-map';

/** Parse a batch jobKey `chapterId:srcMIT:tgtMIT:model:derivative`. Splits from
 *  the RIGHT because a "ver:<uuid>" chapterId contains a colon — a left split
 *  would mis-parse it (chapterId="ver"). The last 4 segments are colon-free. */
export function parseJobKey(jobKey: string): {
  chapterId: string;
  srcMIT: string;
  tgtMIT: string;
  model: string;
  derivative: string;
} {
  const parts = jobKey.split(':');
  const derivative = parts.pop() ?? '';
  const model = parts.pop() ?? '';
  const tgtMIT = parts.pop() ?? '';
  const srcMIT = parts.pop() ?? '';
  return { chapterId: parts.join(':'), srcMIT, tgtMIT, model, derivative };
}

const GEMINI_LANG_NAME: Record<string, string> = {
  th: 'Thai',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese (Simplified)',
  'zh-hk': 'Chinese (Traditional)',
  'zh-ro': 'Chinese (Romanized)',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  ru: 'Russian',
  pt: 'Portuguese',
  'pt-br': 'Brazilian Portuguese',
  it: 'Italian',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ar: 'Arabic',
};

export function geminiLangName(isoLang: string): string {
  return GEMINI_LANG_NAME[isoLang.toLowerCase()] ?? isoLang;
}
/** RTL reading order — panels sort right→left for these original languages */
function isRtlLang(isoLang: string): boolean {
  return ['ja', 'ko', 'zh', 'zh-hk', 'zh-ro'].includes(isoLang.toLowerCase());
}

// ─── MIT key/config builders (#229) ───────────────────────────────────────────
// Pure, dependency-light free functions taking explicit args + an injected `env`.
// These are the single source of truth whose drift silently breaks cancellation
// (jobKey) and cache hits (patch cache key). BooksService delegates to them so
// they can be unit-tested in isolation with zero mocks (see mit-config.spec.ts).

/** Whether to send the source language to MIT (default true). Off lets MIT
 *  auto-detect — set MIT_SEND_SOURCE_LANG to false/0/no/off to disable. */
export function shouldSendMitSourceLang(env: NodeJS.ProcessEnv): boolean {
  const raw = (env.MIT_SEND_SOURCE_LANG ?? 'true').trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(raw);
}

/** Resolve the MIT source/target language codes for a job. Single source of
 *  truth so the cache key and the batch jobKey are always built identically —
 *  a mismatch here silently breaks cancellation (the cancel path looks up a
 *  jobKey that the start path never registered). */
export function mitLangPair(
  env: NodeJS.ProcessEnv,
  sourceLang?: string,
  targetLang?: string,
): { srcMIT: string; tgtMIT: string } {
  const srcMIT =
    shouldSendMitSourceLang(env) && sourceLang
      ? mitLangCode(sourceLang)
      : 'ANY';
  const tgtMIT = mitLangCode(targetLang ?? 'th');
  return { srcMIT, tgtMIT };
}

/** Normalize a Gemini model name: strip a leading `models/` prefix and trim.
 *  Returns null for absent/empty input. */
export function normalizeGeminiModelName(model?: string | null): string | null {
  const normalized = (model ?? '').trim().replace(/^models\//i, '');
  return normalized || null;
}

/** Sanitize a user-supplied Gemini model name for use in the MIT config and
 *  cache/registry keys. Returns undefined for absent or unsafe values so the
 *  pipeline falls back to MIT's default model (#87). */
export function imageModelKey(imageModel?: string): string | undefined {
  const normalized = normalizeGeminiModelName(imageModel);
  return normalized && /^[\w.-]+$/.test(normalized) ? normalized : undefined;
}

/** Short hash of every MIT_* env knob (the render/pipeline config). Two deployments
 * with different render settings get different patch-cache keys, and toggling a knob
 * invalidates the cache for that page — so a config change is visible on the next
 * translate instead of replaying stale patches. */
export function renderConfigHash(env: NodeJS.ProcessEnv): string {
  const knobs = Object.keys(env)
    .filter((k) => k.startsWith('MIT_'))
    .sort()
    .map((k) => `${k}=${env[k] ?? ''}`)
    .join('\n');
  return createHash('sha1').update(knobs).digest('hex').slice(0, 10);
}

/** Single source of truth for the per-page patch cache key. v4 adds the model
 *  segment so different image-translation models never share cached patches
 *  (#87); old v3 entries expire naturally via TTL. */
export function patchCacheKey(
  env: NodeJS.ProcessEnv,
  chapterId: string,
  pageIndex: number,
  srcMIT: string,
  tgtMIT: string,
  imageModel?: string,
  derivative: 'hd' | 'saver' = 'hd',
): string {
  const model = imageModelKey(imageModel) ?? 'default';
  // v5: keyed by display derivative (#156). v6: series context (#157)
  // changes translations — context-aware and context-free patches never mix.
  // v7: include a hash of the MIT render/pipeline knobs so that changing a render
  // env (font, anti-overlap, sizes, SFX, …) busts the cache instead of silently
  // serving the previously-rendered patches.
  return `translate:manga-patches:v7:${chapterId}:${pageIndex}:${srcMIT}:${tgtMIT}:${model}:${derivative}:${renderConfigHash(env)}`;
}

/** The registry key for a batch-translate job. MUST be built via mitLangPair
 *  on every path (start, attach, remove) or cancellation breaks. Includes the
 *  image model so two model selections for the same chapter never collide. */
export function buildJobKey(
  env: NodeJS.ProcessEnv,
  chapterId: string,
  sourceLang?: string,
  targetLang?: string,
  imageModel?: string,
  derivative: 'hd' | 'saver' = 'hd',
): string {
  const { srcMIT, tgtMIT } = mitLangPair(env, sourceLang, targetLang);
  return `${chapterId}:${srcMIT}:${tgtMIT}:${imageModelKey(imageModel) ?? 'default'}:${derivative}`;
}

/**
 * Build the MIT pipeline config JSON. Single source of truth for the single-page
 * and batch paths so the VRAM/perf knobs never drift between them.
 *
 * Detection/inpainting are the dominant VRAM + latency drivers (activation memory
 * ∝ size²). The defaults match MIT's own tuned Config values (detection 2560,
 * inpainting 2048) — #247: shipping them lower silently dropped small/faint text
 * and blurred the erased plate. They stay env-overridable so a VRAM-tight host can
 * drop them without a redeploy (it IS a quality cut — raise where the GPU allows):
 *   MIT_DETECTION_SIZE     (default 2560)   — text detection resolution
 *   MIT_INPAINTING_SIZE    (default 2048)   — LaMa inpaint resolution
 *   MIT_INPAINTER          (default lama_large)
 *   MIT_INPAINTING_PRECISION (default bf16) — fp32 | fp16 | bf16 (LaMa is a CNN;
 *                                             it has no int4/int8 path — that knob
 *                                             only applies to the local LLM
 *                                             translator via QWEN3_PRECISION).
 *
 * #167 rescue knobs (all opt-in; unset = config identical to before):
 *   MIT_OCR_PROB            — OCR confidence floor in (0,1]. The 48px OCR is
 *                             underconfident on long thin lines and drops text
 *                             it read almost correctly; 0.03 recovers the
 *                             measured worst page (lowest real line = 0.035).
 *   MIT_TEXT_THRESHOLD      — detector text threshold in (0,1]
 *   MIT_DET_INVERT=1        — inverted detection pass (white-on-black text)
 *   MIT_DET_GAMMA_CORRECT=1 — gamma correction before detection
 *
 * #170 bubble segmentation (opt-in; unset = config identical to before):
 *   MIT_BUBBLE_SEG=1        — run a speech-balloon YOLO alongside DBNet and
 *                             tag each text-line region with its balloon mask
 *                             (renderer area, mask-aware crop, OCR scoping).
 */
export function buildMitConfig(
  env: NodeJS.ProcessEnv,
  srcMIT: string,
  tgtMIT: string,
  sourceIso: string,
  imageModel?: string,
  seriesContext?: string,
): string {
  const intEnv = (name: string, fallback: number): number => {
    const n = Number(env[name]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  };
  // #167 rescue knobs — opt-in fractions in (0, 1]; absent/invalid env
  // leaves the config byte-identical to today.
  const fracEnv = (name: string): number | undefined => {
    const n = Number(env[name]);
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : undefined;
  };
  const flagEnv = (name: string): boolean => env[name] === '1';
  // #166 render knobs: offset may be negative; minimum is a positive px floor.
  const signedIntEnv = (name: string): number | undefined => {
    const raw = env[name];
    if (raw === undefined) return undefined;
    const n = Number(raw);
    return Number.isInteger(n) ? n : undefined;
  };
  const posIntEnv = (name: string): number | undefined => {
    const n = signedIntEnv(name);
    return n !== undefined && n > 0 ? n : undefined;
  };
  const ocrProb = fracEnv('MIT_OCR_PROB');
  const textThreshold = fracEnv('MIT_TEXT_THRESHOLD');
  const fontSizeOffset = signedIntEnv('MIT_FONT_SIZE_OFFSET');
  const fontSizeMin = posIntEnv('MIT_FONT_SIZE_MIN');
  const supersampling = posIntEnv('MIT_SUPERSAMPLING');
  const fontMaxBoxRatio = fracEnv('MIT_FONT_MAX_BOX_RATIO');
  const patchFeather = posIntEnv('MIT_PATCH_FEATHER');
  const inpaintContextPad = posIntEnv('MIT_INPAINT_CONTEXT_PAD');
  const fontSizeMax = posIntEnv('MIT_FONT_SIZE_MAX');
  const model = imageModelKey(imageModel);
  return JSON.stringify({
    translator: {
      target_lang: tgtMIT,
      ...(srcMIT !== 'ANY'
        ? { source_lang: srcMIT, source_lang_only: true }
        : {}),
      // Per-request Gemini model override (#87); MIT falls back to its
      // GEMINI_MODEL env when absent.
      ...(model ? { model } : {}),
      // Series context (#157): MIT appends this to the translator system
      // prompt so the model knows which manga it is translating. Absent →
      // prompt identical to the context-free behavior.
      ...(seriesContext ? { series_context: seriesContext } : {}),
    },
    detector: {
      // #247: match MIT's own tuned Config default (2560). 2048 silently
      // dropped small/faint glyphs below DBNet's threshold (~36% fewer px),
      // leaving original text untranslated. Env still drops it for tight VRAM.
      detection_size: intEnv('MIT_DETECTION_SIZE', 2560),
      ...(textThreshold !== undefined ? { text_threshold: textThreshold } : {}),
      ...(flagEnv('MIT_DET_INVERT') ? { det_invert: true } : {}),
      ...(flagEnv('MIT_DET_GAMMA_CORRECT') ? { det_gamma_correct: true } : {}),
      // Bubble segmentation (#170): run a speech-balloon YOLO alongside DBNet
      // and tag each text-line region with its balloon mask, so the renderer
      // can size text to the balloon area. Absent → stage off, byte-identical.
      ...(flagEnv('MIT_BUBBLE_SEG') ? { det_bubble_seg: true } : {}),
      // SFX detector (#168): second YOLO pass for stylized katakana SFX that
      // DBNet can't see. Absent → stage off, byte-identical.
      ...(flagEnv('MIT_SFX_DETECTOR') ? { det_sfx: true } : {}),
    },
    // OCR prob floor (#167): the 48px OCR is underconfident on long thin
    // lines — at the default threshold it drops lines it read almost
    // correctly, leaving the original text visible in the Reader.
    // vlm_rescue (#168/#172): large regions the 48px drops (stylized SFX) get
    // re-read by the custom_openai/9arm vision gateway. Absent → byte-identical.
    ...(ocrProb !== undefined || flagEnv('MIT_OCR_VLM_RESCUE')
      ? {
          ocr: {
            ...(ocrProb !== undefined ? { prob: ocrProb } : {}),
            ...(flagEnv('MIT_OCR_VLM_RESCUE') ? { vlm_rescue: true } : {}),
          },
        }
      : {}),
    inpainter: {
      inpainter: env.MIT_INPAINTER ?? 'lama_large',
      // #247: match MIT's tuned Config default (2048). 1536 downscaled pages
      // before the LaMa erase then upscaled back → blurrier plate / screentone
      // smear. Env still drops it for tight VRAM (it IS a quality cut).
      inpainting_size: intEnv('MIT_INPAINTING_SIZE', 2048),
      inpainting_precision: env.MIT_INPAINTING_PRECISION ?? 'bf16',
      // #249: inpaint a crop expanded by N px (patch path) so LaMa sees real
      // background instead of a starved tight crop. Absent → tight, byte-identical.
      ...(inpaintContextPad !== undefined
        ? { inpaint_context_pad: inpaintContextPad }
        : {}),
      // Full-page inpaint (patch path): erase text on the WHOLE page once so LaMa has
      // full context (clean over complex/dark art, no per-crop gray blob). Absent →
      // per-crop inpaint, byte-identical.
      ...(flagEnv('MIT_PATCH_FULLPAGE_INPAINT')
        ? { full_page_inpaint: true }
        : {}),
    },
    render: {
      direction: 'auto',
      rtl: isRtlLang(sourceIso),
      // Font-size fidelity (#166): the renderer's auto floor (img.h+img.w)/200
      // is tiny in patch mode (computed from the crop). Absent → render
      // identical to the auto behavior.
      ...(fontSizeOffset !== undefined
        ? { font_size_offset: fontSizeOffset }
        : {}),
      ...(fontSizeMin !== undefined ? { font_size_minimum: fontSizeMin } : {}),
      // Bubble area-fit sizing (#166): size each region's font to its balloon
      // area (#170 bubble_box) instead of the source textline column. Needs
      // MIT_BUBBLE_SEG to supply the masks. Absent → byte-identical.
      ...(flagEnv('MIT_BUBBLE_AREA_FIT') ? { bubble_area_fit: true } : {}),
      // Anti-overlap: clamp each region's fit box against its neighbours so
      // translated text can't grow into the adjacent bubble. Absent → byte-identical.
      ...(flagEnv('MIT_ANTI_OVERLAP') ? { anti_overlap: true } : {}),
      // Cap narration/caption font (SFX exempt) so it can't oversize/overflow the
      // panel. Absent → no cap, byte-identical.
      ...(fontSizeMax !== undefined ? { font_size_max: fontSizeMax } : {}),
      // Clean horizontal layout: lay non-balloon, non-SFX text out as an upright
      // block at a small absolute font (font_size_max, else page-scaled) instead of
      // warping it onto the original vertical-JP quad (which stretches it oversized).
      // Absent → byte-identical.
      ...(flagEnv('MIT_CLEAN_LAYOUT') ? { clean_layout: true } : {}),
      // #176: render Latin/EN targets in the bundled comic font instead of the
      // worker's Prompt-Bold (a Thai face). Absent → byte-identical.
      ...(flagEnv('MIT_EN_COMIC_FONT') ? { en_comic_font: true } : {}),
      // #181: text supersampling factor (render Nx then downscale). Absent → 1.
      ...(supersampling !== undefined ? { supersampling } : {}),
      // Render-parity A: ALL-CAPS lettering (MangaTranslator pipeline.py:1375).
      // The MIT renderer already honors render.uppercase. Absent → byte-identical.
      ...(flagEnv('MIT_EN_UPPERCASE') ? { uppercase: true } : {}),
      // Render-parity C: raise the #175 bubble-fit font cap (0.5·balloon height)
      // so text fills the balloon. Fraction in (0,1]. Absent → byte-identical.
      ...(fontMaxBoxRatio !== undefined
        ? { font_max_box_ratio: fontMaxBoxRatio }
        : {}),
      // Render-parity B: override the EN face by filename in fonts/ (operator-set,
      // MangaTranslator BYO font). Absent → byte-identical.
      ...(env.MIT_EN_FONT ? { en_font: env.MIT_EN_FONT } : {}),
      // #173: feather the outer N px of each patch to a transparent alpha so the
      // patch edge blends into the page (no rectangular seam). Absent → hard alpha,
      // byte-identical.
      ...(patchFeather !== undefined
        ? { patch_feather_radius: patchFeather }
        : {}),
    },
  });
}
