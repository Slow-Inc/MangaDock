# Inpaint Cleanliness — why MIT text-removal is less clean than upstream zyddnys

**Date:** 2026-06-12 · **Method:** ultracode fan-out (6 agents, ~510k tokens) comparing
`C:\Github\MangaDock\MIT` vs `C:\Github\MangaDock\manga-image-translator-Original`
(the zyddnys/manga-image-translator upstream MIT forked from), file:line level, no black boxes.

**One-line verdict:** the entire cleanliness gap lives on the **input/output side of an UNMODIFIED LaMa** —
the MIT-only **patch path** (translate_patches), not the model, precision, or core mask/CRF code. Upstream has
no patch mode; it inpaints the full page once.

---

## Ranked root causes (high → low)

| # | Root cause (file:line) | MIT vs upstream | Visible symptom | Conf |
|---|---|---|---|---|
| **1** | **Blocky `text_only_mask` union** — `cv2.max(patch_ctx.mask, text_only_mask)` (`patch_renderer.py:110`); `text_only_mask` = fillPoly + dilate + MORPH_CLOSE 3–9px (`patch_geometry.py:45-73`) | Upstream uses ONLY the CRF-tightened mask hugging glyph strokes — no rectangular/polygon union | LaMa forced to inpaint a fat halo of clean background around every glyph → screentone/gradient/line-art next to bubbles destroyed; smeared/tone-mismatched fill | high |
| 2 | **Context starvation** — patch inpaints a tight crop (pad 40 + render_extra 80 = 120px surround, `manga_translator.py:1449-1450`); upstream inpaints the FULL page (`manga_translator.py:584`) | LaMa FFC global branch (ratio_gin/gout=0.75) has almost no clean background to copy from a small crop | Blurry/flat/averaged fill inside bubbles instead of clean white / matching screentone; worst on textured bg + long text | high |
| 3 | **Hard rectangular opaque composite** — patch is opaque RGB/L PNG, `img_alpha=None` (`patch_renderer.py:91`, `patch_png.py:32-39`), hard-pasted CSS abs-pos no feather (`MangaReader.tsx:1655-1668`) | Upstream edits the full page in place, never composites a patch — seam structurally impossible | Sharp **rectangular seam / tone-step** around every bubble (recompressed margin + RGB→L flatten + browser rescale + bf16 tone drift) | high |
| 4 | **`inpainting_size=1536` vs 2048** — Backend forces 1536 (`books.service.ts:667`); MIT Config + upstream default = 2048 (`config.py:345` / orig `config.py:294`) | LaMa sees page at ~56% area res, then bilinear-upscales fill back (`inpainting_lama_mpe.py:64,116`) | Softer/low-frequency fill, broken screentone continuity, soft smudge on erased text; worst on tall pages | high |
| 5 | **Pre-refinement mask blur** — `crop_mask_for_patch` resizes 2× page mask `INTER_LINEAR` then re-binarizes (`patch_geometry.py:122-124`) | Upstream keeps mask full-size, never bilinear-resamples a binary mask | Fattened/blurred thin mask edges → soft seams at patch borders | high |
| 6 | **pydensecrf soft-fail** — `refine_mask` returns RAW mask if import fails (`text_mask_utils.py:68-78`); upstream hard-imports, always runs DenseCRF | **DORMANT** — pydensecrf IS installed in dev `.venv`. Only bites a deploy missing the dep | (conditional) under-covered glyph edges → faint leftover text residue | med (cond) |

## The single biggest cause

**The blocky `text_only_mask` union (`patch_renderer.py:110`).** It ORs a dilated + MORPH_CLOSE rectangular/polygon
mask on top of the CRF-tightened mask, *before* the byte-identical LaMa composite
`ans = img_inpainted*mask + img_original*(1-mask)` (`inpainting_lama_mpe.py:117`). Since the composite only changes
`mask=1` pixels, fattening the mask forces LaMa to erase + re-synthesize a halo of non-text background around every
glyph. Compounds with #2 (the larger halo must be hallucinated from an already-starved crop). Leftover-text risk is
LOW (mask is aggressive); **background-destruction/blur is the dominant MIT-specific defect.**

## Fixes, ranked by ROI (all keep the LaMa / light-hardware constraint — no Flux)

| Rank | Fix | Type | Targets |
|---|---|---|---|
| 1 | **Tame the union** (`patch_renderer.py:110`): use `text_only_mask` only where the refined mask is EMPTY (per-region fallback), or erode it 1 step before `max` | code, surgical | #1 (biggest) |
| 2 | **Raise `inpainting_size` 1536→2048** (`MIT_INPAINTING_SIZE=2048` or `books.service.ts:667`) | config, 1-line | #4 |
| 3 | **`INTER_NEAREST` for mask resize** (`patch_geometry.py:122`) | code, 1-arg | #5 |
| 4 | **Distance-transform alpha feather** (= issue **#173**): per-patch RGBA, soft alpha ramp ~16–24px edge via `cv2.distanceTransform`, emit RGBA in `patch_png.py` (skip `convert('L')`); browser already alpha-blends | code, 2-file | #3 (seam) |
| 5 | **Larger inpaint context crop**: compute a separate larger inpaint crop (bbox + ~256px) for `_run_inpainting`, slice back to the render rect | code, moderate | #2 |
| 6 | **Harden pydensecrf**: pin in `requirements.txt` + worker image + `log.warning` once on fallback | dep/observability | #6 |

**Cheap wins first:** #2 (config) + #3 (1-arg) = near-zero risk. #1 = highest impact. #4 = definitive seam fix.

## What is NOT the cause (do not chase)

- **LaMa model / `_infer` / precision** — `inpainting_lama*.py` + `common.py` **byte-identical** between repos; bf16 is the intended path. Do NOT switch precision.
- **Mask-refinement algorithm + params** — `mask_refinement/__init__.py` byte-identical; defaults identical (`kernel_size=3`, `mask_dilation_offset=20`, `ignore_bubble=0`, `fit_text`); Backend overrides none.
- **Recent refactors (#187/#189/#190/#191/S22)** — patch-path mask/inpaint behavior byte-identical pre-refactor; they did NOT change behavior.
- **pydensecrf (dev)** — installed in `MIT/.venv`; fallback dormant. Verify only the production/worker image.

## Issues (published 2026-06-12)

| Root cause | Issue |
|---|---|
| #1 mask union halo + #5 bilinear mask resize | **#248** (NEW) tame patch inpaint mask — drop blocky halo + `INTER_NEAREST` |
| #4 `inpainting_size` 1536→2048 (+ detection_size 2560) | **#247** (NEW) raise Backend MIT config defaults |
| #2 context starvation | **#249** (NEW) larger inpaint context crop (blocked-by #247) |
| #3 hard rectangular seam (alpha feather) | **#173** (AMENDED — MIT-side file:line evidence added) |
| #6 pydensecrf soft-fail | **#251** (NEW) harden pydensecrf fallback |
