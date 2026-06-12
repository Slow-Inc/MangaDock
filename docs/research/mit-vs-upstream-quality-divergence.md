# MIT vs zyddnys/manga-image-translator — where MIT lowered quality (no black boxes)

**Date:** 2026-06-12 · **Method:** ultracode fan-out (8 agents, ~748k tokens) comparing
`C:\Github\MangaDock\MIT` vs `C:\Github\MangaDock\manga-image-translator-Original` (the fork-parent) at
file:line across the whole pipeline. Companion to `docs/research/inpaint-cleanliness-vs-upstream.md`
(inpaint cleanliness covered there, not repeated).

**Throughline:** MIT's **patch mode** (`translate_patches`, the sole production path) is the unifying root.
But cropping itself degrades only **render**; the larger losses are **translation cross-page context** (killed in
the patch path) and **two Backend config knobs** set below MIT's own tuned defaults.

---

## 1. Ranked quality-loss divergences (high → low)

| # | Divergence (MIT file:line vs upstream) | Stage | Mechanism | Conf |
|---|---|---|---|---|
| 1 | **Cross-page rolling context dead** — `translate_patches` calls `reset_page_context()` + never persists pages (`manga_translator.py:1408`); batch loop re-parses config per page (`server/batch_runner.py:18,28,53`). Upstream joins ALL batch pages into one numbered prompt (`Original/manga_translator.py:1502-1524`). | translation | **Lost context** — names/honorifics/pronouns/terminology drift page-to-page (romanized one way p.3, another p.7). Upstream sees every region of every page; MIT sees one isolated page. | high |
| 2 | **detection_size=2048** vs MIT's tuned default 2560 (`books.service.ts:640` overrides `config.py:317`) | detection / config | **Missed text** — DBNet long-side ~20% lower (~36% fewer px); small/faint glyphs fall below threshold → never become textlines → original JP stays visible, untranslated. (2048 = upstream's *shipped* default; regression is vs MIT's own raised 2560.) | high |
| 3 | **inpainting_size=1536** vs default 2048 (`books.service.ts:667` overrides `config.py:345`; downscale/upscale `inpainting_lama_mpe.py:64-66,115`) | inpaint / config | **Blur** — >1536px page downscaled before LaMa erase then upscaled → blurrier plate, halos on screentone. Erase fidelity only, not text accuracy. | high |
| 4 | **Renderer auto font-floor from CROP not page** — `font_size_minimum=(img.h+img.w)/200` on the small crop (`rendering/__init__.py:163-164`, crop at `patch_renderer.py:128`); default `-1` never overridden | render (patch) | **Default-render regression** — ~300×400 crop → floor ~3-4px vs page's ~16px. On the **fallback path** (vertical / occupancy>1 / no balloon / SFX) text renders unreadably small. Bubble-fit path bypasses the floor, so cleanly-detected horizontal dialogue is safe. | high |
| 5 | **context_size never enabled** — `buildMitConfig` emits no `context_size`; `--context-size` omitted (`server/main.py:396-418`) → always 0, `prev_context.py:21-22` short-circuits | translation | Corollary of #1 — confirms no alternate path self-heals cross-page awareness; rolling-context machinery present but unreachable in prod. | high |
| 6 | **Few-shot lookup** langcodes fuzzy-match → exact dict lookup, `[]` on miss (`config_gpt.py:254-271` vs `Original:233-281`) | translation | **Mistranslation (narrow)** — exotic codes (en-AU, pt-PT) lose the in-context example. **NOT triggered in prod** (Backend sends THA/ENG). | med |

---

## 2. The patch-mode tax

Patch mode keeps **detection / OCR / textline-merge / translation page-level** (NOT degraded by cropping); it
isolates only mask / inpaint / render per region-group crop. The tax falls on two stages + the translation isolation:

| Stage in patch mode | Degraded? | Cost |
|---|---|---|
| Detection / OCR / Textline-merge | **No** | full-page single pass before translation |
| **Translation** | **Yes** | `reset_page_context()` per page + never persists → **cross-page consistency lost** (#1/#5). Largest tax. |
| Mask refinement | No | per-textline CC bounded; 120px crop margin keeps components whole |
| Inpaint (LaMa) | No (net) | per-crop FFT loses global context but gains native res (crop ≤1536 not downscaled) — neutral-to-better |
| **Render** | **Yes** | crop-derived font floor (#4) on fallback path → tiny text |
| Patch PNG re-encode | No | lossless (`compress_level=1`), ICC carried (#156) |

**Cumulative:** one **structural** translation regression (cross-page consistency) + one **render** regression
(crop font floor). Mask/inpaint/seam/encode are well-guarded (120px margin + `group_regions` overlap-merge prevent
split bubbles / visible seams).

---

## 3. Config quick-wins (Backend `buildMitConfig` silently below default)

| Knob | Current | Fix | Effect |
|---|---|---|---|
| `detection_size` | 2048 | `MIT_DETECTION_SIZE=2560` (or `books.service.ts:640`) | recovers missed small text; ~1.56× detection activation mem |
| `inpainting_size` | 1536 | `MIT_INPAINTING_SIZE=2048` (or `books.service.ts:667`) | sharper erase; 2048 is the tuned operating point |
| `font_size_minimum` | -1 (auto=crop/200) | `MIT_FONT_SIZE_MIN`~14-16 | floors fallback-path text to readable size |

Everything else matches default / off-by-default opt-in (`lama_large`, `bf16`, `ocr.prob` omitted, all rescue/render
knobs absent) → **no further regression**.

---

## 4. Ranked fixes (ROI) — surgical, keep LaMa / light-HW

| Rank | Fix | Type | Notes |
|---|---|---|---|
| 1 | `MIT_DETECTION_SIZE=2560` | **config** | biggest recall win; drop to 2048 only if OOM |
| 2 | `MIT_INPAINTING_SIZE=2048` | **config** | sharper erase; keep 1536 only if VRAM-bound (it IS a quality cut) |
| 3 | Page-scaled font floor in patch mode | structural (small) | `patch_renderer.py`: `page_min=round((img_h+img_w)/200)`, set `config.render.font_size_minimum=max(existing,page_min)` on a per-request copy before `process_group`; gate so full-page `_translate` untouched |
| 4 | Thread rolling cross-page context | structural (medium) | in `run_batch_with_callbacks` keep prior pages' `{text:translation}`, seed `_translation_memory.all_page_translations` before each page, append after; stop per-page `reset_page_context()`. Opt-in flag. Pure prompt change, no extra model. Keep `series_context` (orthogonal). **= the PRD #155/#159 context-aware work.** |
| 5 | Few-shot regional fallback | structural (tiny) | only if exotic targets added; strip region subtag, retry base-language sample before `[]`. No live impact (THA/ENG). |

**Do first (zero code):** #1 + #2 — two env vars recover the two biggest default-mode losses.
**Schedule:** #3 render floor, #4 cross-page context.

---

## 5. NOT the cause (do not chase — byte-identical / equivalent)

- **OCR** — model/dispatch/crop byte-identical (`model_48px.py`, `ocr/common.py`, `get_transformed_region`, `is_valuable_text`); `OcrConfig` defaults identical. Live `ocr.prob=0.03` is an opt-in that **RECOVERS** text (net gain). OCR input is full-page byte passthrough — no crop/recompress.
- **Detection algorithm** — byte-identical; only `detection_size` value differs (#2). thresholds resolve to identical defaults. SFX pass is additive opt-in (off).
- **Textline-merge grouping** — translation grouping runs once per page with full-page dims in BOTH; MIT's per-crop `_group_nearby_regions` is render-only/post-translation, can't change merge units. The one diff (`__init__.py:197`) touches only inert `TextBlock.prob`; MIT's is the more-correct weighted mean.
- **Default render path (knobs OFF)** — byte-identical in every quality-relevant respect. #189/#190 dedup preserved behavior; always-on deltas are inert at default or are safety fixes (off-canvas clamp, `M is None` guard, `np.maximum` glyph blend — improves overlap). Prompt-Bold default = intentional Thai product choice.
- **Mask refinement / per-crop inpaint context / inter-group seam / patch PNG encode** — all non-regressions (per-textline-bounded CC + 120px margin; native-res crop net neutral-to-better; grouping prevents split bubbles; PNG lossless + ICC-correct).
- **`series_context`** — a signal upstream LACKS (genre/character anchoring); not a regression. Partially masks but doesn't substitute for #1 — keep it alongside the rolling-context fix.

---

**Net:** MIT did NOT degrade the OCR/detection-algorithm/render-code/mask core (byte-identical to upstream). The
real quality losses are **(a) two Backend config knobs below MIT's own tuned defaults (1-line each)** and
**(b) the patch path killing cross-page translation context + a crop-derived font floor (two small structural fixes)** —
all fixable without leaving LaMa / light hardware.

## Issues (published 2026-06-12)

| Quality loss | Issue |
|---|---|
| #1/#5 cross-page rolling context dead (`reset_page_context` + `context_size` unreachable) | **#159** (AMENDED — prod root-cause evidence added; = PRD #155/#159) |
| #2 detection_size 2048→2560 + #3 inpainting_size 1536→2048 | **#247** (NEW) raise Backend MIT config defaults |
| #4 crop-derived font floor → tiny fallback-path text | **#250** (NEW) page-scaled font floor in patch mode |
| #6 few-shot langcodes→dict (exotic targets) | not filed — no live impact (THA/ENG map cleanly); documented here only |

Inpaint-cleanliness issues (companion doc): #248, #249, #173, #251, #247.
