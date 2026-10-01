# ADR 025 — Clean-layout narration scales by page resolution, not the per-region crop

- **Status:** Accepted (2026-06-30)
- **Issues:** #175 (sizing), follow-up to the full-chapter Gal Yome EN→Thai benchmark.
- **Area:** MIT render — `rendering/__init__.py` (`_clean_layout_dst`, `resize_regions_to_font_size`, `dispatch`), `stages.py`, `patch_renderer.py`.
- **Builds on:** ADR 023 (bubble-area-fit, bounded sizing), ADR 024 (width-squeeze). Same crop-vs-page bug class as #175's bubble-fit fix, but for the clean-layout branch.

## Context

`resize_regions_to_font_size` routes each region to bubble-fit (dialogue), clean-layout (narration/caption), or legacy. Clean-layout sizes the font as `font_size_max × processing_scale(area)` (`clean_layout_font_size`), where `processing_scale = sqrt(megapixels)` makes the font track page resolution.

In production every region is rendered in its **own crop** (`translate_patches`: per-region PNG patches). The crop is a full-resolution sub-rectangle but has a small **area**, so `processing_scale(crop)` collapses to its `0.5` clamp floor. Result: clean-layout narration came out ~3× smaller than designed — `font_size_max=20` → `20 × 0.5 = 10`, floored to the page-scaled minimum ≈17px, instead of the intended `20 × processing_scale(3 MP page=1.73) = 35px`.

Dialogue did **not** shrink because bubble-fit is box-height-driven (ADR 023, page-independent). So on a single page the reader saw normal-sized dialogue next to tiny narration — the user-reported "ทำไมตัวเล็กทั้งที่มีตัวขนาดปกติอยู่ด้วย". `_clean_layout_dst` used the crop `img.shape` for three page-relative quantities: the font `processing_scale`, the wrap-width clamp (% of width), and the generous max wrap height.

## Decision

Thread the full-**page** shape (already known in `PatchRenderer` as `img_w/img_h`, the source of `page_scaled_font_min` #250) to the clean-layout sizing: `patch_ctx.page_shape` → `stages.run_text_rendering` → `dispatch` → `resize_regions_to_font_size` → `_clean_layout_dst`. There, use `page_shape` (when provided) instead of `img.shape` for the font scale, wrap-width clamp, and max wrap height. The full-page render path passes `page_shape=None` → falls back to `img.shape` (which *is* the page there) → **byte-identical**.

Bubble-fit and legacy paths are untouched.

## Consequences

- **Positive:** clean-layout narration/caption now renders at its designed page-scaled size (~35px vs ~17px on a 3 MP page) — readable and consistent with dialogue. The crop-vs-page bug is now fixed for *both* sizing branches (#175 bubble-fit via box height; clean-layout via page_shape).
- **Validated:** unit pin `clean_layout_font_size(20, crop)→floor` vs `(20, page)→35`; render golden/guard byte-identical (page_shape=None path); 38 render_overlap + patch_renderer + stages green. E2E (Gal Yome EN ch1 p14 → Thai): the previously-microscopic top-right narration renders as readable 3-line text; no crashes, nothing oversized.
- **Scope/limits:** does not change *which* regions go to clean-layout (the rw/bw discriminator from #175 residual #2 still routes narration-in-large-bubble there). It only fixes the size once a region is in clean-layout. Tuning `MIT_FONT_SIZE_MAX` still controls the absolute base.
- **Reversibility:** stop threading `page_shape` (or pass None) → clean-layout reverts to crop-scaled; all other paths byte-identical.

## Addendum (2026-06-30) — display captions track the ORIGINAL lettering size

The page-scale fix above made the clean-layout font a single **flat** size (`font_size_max` × page-scale ≈ 26px) for every clean-layout region. That is right for narration but **collapses a big stylized display caption to narration size**: measured on Gal Yome EN→Thai page 11, "LOVE IS FORBIDDEN" was lettered at 96px in the source yet rendered at the same ~26px as a 21px narration line (3.7× too small); "IN THIS COMPANY" 67px → 26px.

**Refinement:** `clean_layout_target_fs(orig_fs, clean_fs_flat)` — narration (`orig ≤ flat`) returns the flat size **unchanged** (this ADR's behaviour byte-identical, no regression); a **display caption** (`orig > flat`, i.e. original lettering markedly larger than the flat clean font) renders near its **original** size (cap 120). `_clean_layout_dst` then wraps a sized-up caption to its own wider source footprint (avoids mid-word breaks) and shrinks only to keep the block within `1.6×` the caption's original height, never below flat.

- **Validated:** `docs/reports/benchmarks/2026-06-30-clean-layout-caption-size.md` — page 11 captions now render large + clean-wrapped, matching original prominence; narration unchanged. +3 `test_render_overlap` cases (`clean_layout_target_fs`: narration-unchanged / display-tracks-original / cap); render_overlap+ocr_vlm 68/0.
- **Limit/reversibility:** narration path is untouched, so reverting is just dropping the `orig > flat` branch (clean-layout reverts to the flat page-scaled size for all regions). Display detection is purely `orig_fs > clean_fs_flat` — no new model/heuristic. Overlapping-bubble loss (#436) is separate and still open.

## Addendum (2026-07-01) — clean-layout wrap column never narrower than the longest atomic word (item 9)

The page-scale + caption refinements above fixed the *font size* on the clean-layout path but not its *wrap width*. `_clean_layout_dst` wrapped to the region's source-text bbox width (`clean_wrap_width`). For a **spaceless script** (Thai/Japanese/Khmer/Lao) that column can be narrower than the widest word; the greedy packer then falls through to `_safe_char_split` and **force-splits a word mid-cluster** — measured on the full-chapter Gal Yome EN→Thai benchmark: p25 "ข้างนอก"→"ข้า"/"งนอก", p18 "พยายาม"→"พยาย"/"ามให้", "ไม่เป็นไร"→"ไม่เป็"/"นไร". This only bites **dialogue misrouted to clean-layout** (egg/oval/heart bubbles where `bubble_box is None`, or `fills_bubble_width < 0.72`); the two bubble-fit paths already guard against it (reject font where longest word > column `:110`, squeeze floor = longest word `:122`).

**Refinement:** new pure helper `text_render.longest_token_width(font_size, text, language)` returns the pixel width of the widest **atomic** word (ZWSP-segmented via pythainlp/jieba; for Latin, the widest space-delimited word). `_clean_layout_dst` floors `wrap_w` at that width — mirroring the guard `_bubble_fit_layout` already applies. Language-agnostic: the Latin floor is ≤ the existing wrap, so Latin wraps are byte-identical.

- **Validated:** `docs/reports/benchmarks/2026-07-01-thai-word-break.md` — p25/p18/p11 re-rendered through the worker, every line breaks on a word boundary, no mid-word split; Latin column unchanged. `test/test_thai_wrap.py` 12/12 (+4: `longest_token_width` word-atomic Thai / widest Latin / empty; `_clean_layout_dst` keeps "ข้างนอก" intact in a 40px box). Characterization render goldens byte-identical; render suite 68/0 + 1 pre-existing async-infra skip.
- **Side-effect:** item 2 (under-fill) is *incidentally* improved on misrouted dialogue (the floored column lets the fitter use more width) but font sizing is unchanged, so a dedicated item-2 pass is still warranted.
- **Limit/reversibility:** drop the `_lw > wrap_w` floor in `_clean_layout_dst` → reverts byte-identical. `_safe_char_split` is kept as the correct last resort for a genuinely over-wide single word.
