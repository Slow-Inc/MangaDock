# MIT — Pipeline Internals & Upstream Divergence

> Companion to `ARCHITECTURE.md` (which maps the **server layer**: two-process model, queue,
> batch/webhook). This file maps the inside of `manga_translator/` — the stage contracts a page
> flows through — and the **exact delta between MangaDock's fork and upstream**
> (`manga-image-translator`, legacy snapshot at `C:\Github\MetaBooks\MIT`, ~2026-03).
> Model internals (network architectures, weights math) are intentionally out of scope: every
> model is treated as a function with inputs and outputs.

---

## 1. The provenance rule (read this before editing anything)

A full tree diff against the legacy snapshot (ignoring line endings) shows the bulk of
`manga_translator/` is still pristine upstream **stage logic**, but `manga_translator.py`
itself is now a thin driver: the #187/#188 decomposition carved its god-object internals into
many small **byte-identical** modules that delegate back. MangaDock's entire delta is:

- **13 modified + 11 new (features) files** in `manga_translator/` (§5)
- **~22 new (#187/#188 decomposition) files** in `manga_translator/` (§5 decomposition subsection)
- **5 modified + 5 new files** in `server/` (§5)

**Rule:** before editing a file under `MIT/`, check §5.
- File **listed** there → it carries MangaDock-specific behavior. Understand the listed intent
  before touching; never "sync with upstream" blindly — you will revert a deliberate fix.
- File **not listed** → vendor code we have never modified. Safe to treat as a black box; an
  upstream upgrade may overwrite it wholesale.

---

## 2. The `Context` (ctx) lifecycle

`Context` (`utils/generic.py`) is a loose attribute bag; missing attributes read as `None`.
Stages communicate exclusively through it:

| Attribute | Type | Written by | Meaning |
|-----------|------|-----------|---------|
| `input` | PIL.Image | `translate()` | Original input (may be RGBA/P) |
| `img_rgb` | np.ndarray | load step | Working RGB image (after optional colorize/upscale) |
| `img_alpha` | Image\|None | load step | Original alpha channel, recomposed at the end |
| `textlines` | List[Quadrilateral] | detection → enriched by OCR → filtered by lang-skip | Raw detected lines (**reassigned 3×** — know which stage you're after) |
| `mask_raw` | np.ndarray\|None | detection | Raw text mask (may be ~2× image size; rescaled later) |
| `text_regions` | List[TextBlock] | textline_merge | Merged regions — the pipeline's main currency; `.translation` filled by translation stage |
| `mask` | np.ndarray | mask_refinement | Final binary inpainting mask (built **after** translation, from surviving regions only) |
| `img_inpainted` | np.ndarray | inpainting | Text erased |
| `img_rendered` | np.ndarray | rendering | Translation drawn |
| `result` | PIL.Image | dump | Final RGBA output |

Early exits: no textlines after detection / after OCR / no regions after filtering → pipeline
returns the (upscaled) original, untranslated. This is why an "empty" page is fast and silent.

---

## 3. Stage contracts — front half

### 3.1 Detection (`detection/`)
- **Contract:** RGB image + `detection_size` → (`textlines: List[Quadrilateral]`, `mask_raw`).
- Dispatcher caches detector instances by key (`default` = DBNet, `dbconvnext`, `craft`, `paddle`, `none`; the vendored `ctd`/YOLOv5 was removed in #191).
- Pre-filters applied in order: rotate → border (min 400px) → invert → gamma; quads with
  `area < 1` dropped; `det_auto_rotate` may re-run detection on the rotated image.
- **Knobs:** `detection_size` (2560 default; MangaDock sends 2048 via Backend env
  `MIT_DETECTION_SIZE`), `text_threshold` .5, `box_threshold` .7, `unclip_ratio` 2.3.
- **Gotcha:** `mask_raw` can come back larger than the image (detector upsamples); downstream
  crop code handles the size mismatch — keep it that way.

### 3.2 OCR (`ocr/`)
- **Contract:** image + textlines → same textlines with `.text` + per-line fg/bg colors.
- Models: `48px` (default), `48px_ctc`, `32px`, `mocr`. Crops are perspective-transformed per
  line before recognition.
- Empty-text lines are dropped after OCR; `config.render.font_color_*` overrides the extracted
  colors when set.
- **Knobs:** `ocr`, `min_text_length`, `prob` (None → model default), `ignore_bubble` (applied
  later, in mask refinement).

### 3.3 Textline merge (`textline_merge/`)
- **Contract:** textlines + image dims → `List[TextBlock]`.
- Algorithm: NetworkX graph — edge when two quads "can merge" (hardcoded aspect/font/char-gap
  tolerances) → connected components → `split_text_region()` re-splits suspicious components
  (distance/angle/MST variance heuristics) → per-region: mean colors, majority direction
  (`h`/`v`), centroid-sorted lines, area-weighted log-prob confidence.
- After merge, `manga_translator.py` applies: lang-skip filter, bracket-balance cleanup,
  `min_text_length` / `is_valuable_text` filters, same-as-target-language skip, then panel-aware
  region sort (`force_simple_sort` falls back to plain top-to-bottom).
- **Gotcha (#111, fixed in our fork):** the merged-prob denominator summed the wrong variable
  upstream; our `textline_merge/__init__.py` carries the fix — do not revert from upstream.

### 3.4 Translation stage
Covered by `ARCHITECTURE.md` §7 (translator subsystem) and §7.1 (dormant page-context engine).
Pipeline-side facts worth knowing:
- `_run_text_translation` applies pre-dict → dispatch → post-dict, then **post-translation
  checks**: per-region repetition/hallucination retry and the page-level target-script-ratio
  check (`utils/lang_ratio.py`, ours — §5) gated by `_PAGE_LANG_CHECK_MIN_REGIONS = 6`.
- `skip_lang` / `source_lang(+source_lang_only)` filters happen around translation using
  `py3langid` detection on the **source** text.

### 3.5 Mask refinement (`mask_refinement/`)
- **Contract:** (surviving `text_regions`, `img_rgb`, `mask_raw`) → final binary `ctx.mask`.
- Runs **after** translation on purpose: only regions that will actually be re-rendered get
  erased.
- Mechanics: connected components of the raw mask are assigned to textlines by overlap ratio
  (distance fallback), then per-region dilation
  (`dilate_size ≈ (text_size + mask_dilation_offset) * 0.3`, ellipse kernel) with optional CRF
  refinement — **pydensecrf is optional in our fork** (§5): when absent, the raw mask is used.
- `ignore_bubble` (1–50): filters non-bubble contours via `utils/bubble.py` heuristic.
- **Knobs:** `mask_dilation_offset` (20), `kernel_size` (3, must stay odd).

---

## 4. Stage contracts — back half

### 4.1 Inpainting (`inpainting/`)
- **Contract:** (image crop, binary mask, `inpainting_size`, precision) → text-erased crop.
- Registry: `lama_large` (MangaDock default via env `MIT_INPAINTER`), `lama_mpe`, `default`
  (AOT), `sd`, `original` (debug: no erase), `none`.
- **Gotchas:** mask must be strictly 0/255 — gray values bleed color. `inpainting_size` (we send
  1536 via `MIT_INPAINTING_SIZE`) is the VRAM lever; too large = hard OOM, no graceful fallback.
  Models are singleton-cached in VRAM until `unload()`.

### 4.2 Rendering (`rendering/`)
Three sub-steps inside `dispatch()`:
1. **Region sizing** — `resize_regions_to_font_size()`: target font =
   (`font_size_fixed` | detected + `font_size_offset`, floored by `font_size_minimum`); box
   grows (≤ ~1.1×, more if line count overflows) when the translation is longer than the
   original; final coords clamped to image bounds.
2. **Glyph rendering** — `text_render.py` draws into an RGBA canvas:
   `put_text_horizontal` / `put_text_vertical`; per-language line breaking — **Thai combining
   marks are kept attached to their base character by `_safe_char_split()` (ours, §5)**;
   hyphenation only for spaced Latin-ish languages (`no_hyphenation` disables).
3. **Warp + composite** — `cv2.findHomography(src→dst)` then alpha-composite onto the inpainted
   image. **Degenerate quads make `findHomography` return `None` — our fork guards this
   (#110, §5); upstream crashes.** The same fix chooses the *effective* render direction
   (`render_horizontally`) instead of the detected orientation.
- Alternate renderers: `manga2eng`(+`pillow`) for English typesetting, `gimp`, `none`.

### 4.3 The patch path (`translate_patches()` — MangaDock's production flow)
- Front half runs **once per page** (`_translate_until_translation` + translation), then regions
  are **proximity-grouped** (union-find on padded AABBs) so overlapping bubbles share one patch.
- Per group, gated by `_PATCH_CONCURRENCY` (env, default 3) on the GPU-bound part:
  crop (+40px pad, +80px render margin) → local-coords region copies → mask refinement →
  inpaint, then **outside** the semaphore: render → PNG encode (thread pool,
  `compress_level=1` + 30s timeout — ours, §5).
- Returns `{img_width, img_height, patches:[{x,y,w,h,img_png}]}` — pixel coords; the Backend
  converts to fractions.

### 4.4 Upscaling / Colorization (rarely enabled)
- `upscaling/` runs **before** detection (`esrgan`, `4xultrasharp`, ...; `revert_upscaling`
  downsizes the result back). `colorization/` (`mc2`) colorizes B&W pages. Both off in
  MangaDock's normal config.

### 4.5 Modes (`mode/`)
| Mode | Entry | Used by us | State |
|------|-------|-----------|-------|
| `share.py` | worker HTTP, pickled I/O | **yes — production worker** | global `_translator` singleton |
| `local.py` | CLI folder mode | no (upstream CLI) | calls `translate_batch` — the path page-context was designed for (ARCHITECTURE §7.1) |
| `ws.py` | websocket streaming | no | experimental |

---

## 5. MangaDock divergence from upstream (the full delta)

### `manga_translator/` — modified (13)

| File | What we changed | Why | Revert hazard |
|------|----------------|-----|---------------|
| `config.py` | Qwen3/Qwen3Big enum entries; env-driven `_default_translator()` (`TRANSLATOR_TYPE` → `DEFAULT_LOCAL/API_TRANSLATOR`); `TranslatorConfig.model` per-request override; `TranslatorConfig.series_context` (#157); `DetectorConfig.det_bubble_seg` (#170); `RenderConfig.bubble_area_fit` (#166); `DetectorConfig.det_sfx` (#168) | #87, local LLM support, #157, #170, #166, #168 | Default translator falls back to upstream's hardcoded choice; per-request Gemini model switching breaks; series context / bubble-seg / area-fit flag unparseable |
| `manga_translator.py` | `reset_page_context()` + call at `translate_patches` start; `_check_target_language_ratio` rewritten to script-ratio (`utils/lang_ratio.py`) with `_PAGE_LANG_CHECK_MIN_REGIONS=6`; PNG `compress_level=1` + 30s encode timeout; `translate_patches` text layer (`regions_payload`, #158); **bubble-seg tagging + balloon-aware `_group_nearby_regions` (delegates to `bubble_association.group_regions`) when `det_bubble_seg` (#170); `_build_local_region` bubble_box **and bubble_polygon** (#179) shift into crop coords + grows the patch crop to cover balloons via `union_box` + threads `render.bubble_area_fit` into `dispatch_rendering` as `bubble_fit` for binary-search font sizing (#166)** | #136 (context bleed), #109 (false-fail lang check), streaming latency, #158, #170, #166 | Context bleeds across jobs again; pages with SFX/credits get falsely rejected; PNG encode can hang forever; scattered-clump grouping returns; bubble text renders at the tiny crop-derived floor |
| `mask_refinement/text_mask_utils.py` | pydensecrf import made optional (fallback: raw mask) | run without CRF dep | Import error on machines without pydensecrf |
| `mode/share.py` | worker `GET /health` endpoint; injects `fonts/Prompt-Bold.ttf` for Thai rendering when no font specified (`:194`) | dead-worker detection (`/ready` probe, 2026-06-06 incident); Thai glyph support. Note: a 2026-06-07 investigation considered lighter weights for downscale halo, but Bold is the deliberate choice — the perceived "tone around patches" issue was the display-derivative mismatch (#156), not the font | `/ready` reports `workers_unreachable` forever; Thai falls back to a font without Thai glyphs |
| `rendering/__init__.py` | use effective `render_horizontally`; guard `findHomography() is None` (#110); `bubble_fit` path in `resize_regions_to_font_size` — `_bubble_fit_font_size()` binary-searches the largest font fitting a region's `bubble_box` (measured via `calc_horizontal`) and renders into the balloon box, bypassing the length-ratio heuristic; gated by `balloon_occupancy()` + a non-whitespace-translation guard (#bug-hunt) so only a real-text sole occupant is fitted (#166); #175 adds anti-overflow safety — `_LINE_HEIGHT` (real ≈1.2× per-line height), `_FIT_MARGIN` 0.92 (wraps calc_horizontal to the margin'd width too, so the search doesn't floor at `low`; empty-`widths` → no-fit, #bug-hunt), `_MAX_FONT_BOX_RATIO` 0.5 cap; #179 wraps to the balloon polygon's safe **interior** (`_bubble_interior_box` → `safe_area_box`) centered on the safe anchor = narrow column; legacy single-axis expansion guards `used_rows/used_cols > 0` against /0 (#bug-hunt) (#166, #175, #179); **#190 dedup** — `_expand_single_axis` (h/v), `_pad_box` (render ratio-padding), named length-ratio constants (byte-identical) | #110, #166, #175, #179 | Crash on degenerate region quads; bubble text falls back to crop-floor / re-inflates / co-occupants stack / overflows / wide-paragraph (not narrow column) / ZeroDivision on empty texts |
| `rendering/text_render.py` | `_THAI_COMBINING` + `_safe_char_split()` in char-level wrapping; **#189 glyph dedup** — put_char_h/v share `_render_glyph_stroke` / `_paste_bitmap` / `_select_face_for_char` (byte-identical); **#186 LineBreaker seam** — `calc_horizontal` Step 1 sits behind a pluggable `LineBreaker` (`GreedyLineBreaker` default = byte-identical; `KnuthPlassLineBreaker` opt-in via `line_breaker=`), so #180 can swap the line-break strategy without touching tokenization or Step 4 assembly; `greedy_postprocess` gates the greedy-only Step 2 | Thai tone marks orphaned on wrap; greedy Step 1 was a monolith blocking #180 (#186) | Corrupted Thai glyphs when lines break; line-break strategy becomes un-swappable again |
| `textline_merge/__init__.py` | prob denominator typo fix (`textlines` → `txtlns`) | #111 | Wrong merged-region confidence |
| `translators/__init__.py` | register qwen3/qwen3_big | local LLM | Qwen3 unselectable |
| `translators/common_gpt.py` | few-shot sample variable typo fix; empty-list `min()` guard; `text2json` missing `self` | bug fixes | GPT few-shot silently broken; crashes on empty translations |
| `translators/config_gpt.py` | `_closest_sample_match` rewritten as direct dict lookup — **dropped `langcodes`/`language_data` deps**; removed stale `self.langSamples` cache | #108 (cross-instance cache bleed) + dependency removal | Re-importing upstream reintroduces removed deps → ImportError |
| `translators/gemini.py` | per-request `_model()` override + cache bypass when model ≠ env (#87); `removeprefix` over `lstrip`; error message fixes | #87 | Model picker in Reader silently ignored; stale Gemini context cache |
| `translators/qwen2.py` | env-driven model/precision via shared `build_load_kwargs` from qwen3 | config parity | Hardcoded 4-bit returns |
| `utils/textblock.py` | mutable-default `shadow_offset` fix; empty `texts` guard | bug fixes | Crash on empty region texts |

### `manga_translator/` — new (features, 11)
- `sfx_merge.py` (#168) — pure geometry, no ML imports: `dedup_sfx_boxes()` drops second-pass SFX-detector boxes already covered (IoA ≥ 0.2 over the candidate's area) by a DBNet textline, so dialogue isn't double-detected. `test/test_sfx_merge.py`. (The AnimeText-YOLO wrapper + pipeline second-pass + proof are a separate slice — gated on model-download approval + the SFX reference pages.)
- `bubble_association.py` (#170, +#166) — pure geometry, no ML imports: `associate_regions_to_bubbles()` tags each text-line region with the balloon mask containing its centroid (smallest-area nested wins; IoA fallback) and `group_regions()` does balloon-aware union-find grouping (different balloons never merge; same balloon always does). #166 adds `balloon_occupancy()` (how many regions share each balloon box — gates the renderer so only a sole occupant is fitted, else co-occupants would stack on one rect) and `union_box()` (clamped axis-aligned union — grows the patch crop to cover a balloon larger than its text-lines; floors mins / ceils maxes so float balloon coords never shrink the box, #bug-hunt). Unit-tested in <1s (`test/test_bubble_association.py`).
- `font_fit.py` (#166, +#175) — pure arithmetic, no ML imports: `fit_font_size(box_wh, measure, low, high, margin=1.0)` binary-searches the largest font whose wrapped block fits the balloon box, via a caller-supplied `measure(size)->(w,h)` callback (the renderer passes one built on `calc_horizontal`; tests pass stubs). #175 adds `margin` — fit to a fraction of the box (e.g. 0.92) so glyph slack can't clip. Drives the `bubble_fit` path in `rendering/__init__.py` when `render.bubble_area_fit`. Replaced the earlier `sqrt(area-ratio)` heuristic, which near-no-op'd on dense boxes. `test/test_font_fit.py`.
- `safe_area.py` (#179, PRD #178) — pure cv2/numpy (no ML/PIL): `safe_area_box(mask)` ports MangaTranslator's distance-transform safe-interior + pole-of-inaccessibility anchor — the largest centered box fitting a balloon mask's interior, anchor moved off a conjoined-bubble neck when centroid distance < 0.70×max. The renderer wraps to this *interior* width (narrow column) instead of the bbox. `test/test_safe_area.py` (synthetic masks, <1s).
- `bubble_detector.py` (#170) — the only bubble-seg ML wrapper: lazy-loads `kitsumed/yolov8m_seg-speech-bubble` (YOLOv8m-seg) and returns one polygon per balloon; best-effort (any failure → no balloons → stage-off behaviour). ~490 MB GPU transient, ~30 ms/page (proof-measured, 12 GB box).
- `translators/qwen3.py` — Qwen3 local translator; exports `build_load_kwargs()` (fp8/bf16/fp16/int8/int4) shared with qwen2.
- `utils/lang_ratio.py` — character-script ratio check (#109); covers CJK/Thai/Arabic/Cyrillic/Latin ranges.
- `utils/patch_png.py` — patch PNG encoding carrying the source page's ICC profile (#156,
  2026-06-07): manga scans often embed a GRAY "Dot Gain 20%" profile; the browser
  color-manages the page through it but renders an untagged patch as sRGB → every patch
  rectangle showed ~10-16 gray levels darker midtones. A GRAY profile is only honored on a
  grayscale image, so the patch saves as mode `L` in that case. `translate_patches` captures
  `image.info['icc_profile']` and threads it to every patch encode. Guarded by
  `test/test_patch_png.py` (fixture: `test/testdata/dotgain20.icc`).
- `series_context.py` (#157) — builds the per-series context string (manga title/synopsis) the
  GPT-family translators prepend so the model knows which work it is translating.
- `text_layer.py` (#158) — `regions_payload` builder: serialises translated regions into the
  patch path's HTTP text-layer contract (`share.py:99`).
- `sfx_detector.py` (#168) — AnimeText-YOLO SFX-detector wrapper (second detection pass);
  best-effort, gated by `config.detector.det_sfx`; pairs with `sfx_merge.py`'s dedup.

### `manga_translator/` — new: #187/#188 god-object decomposition (~22, byte-identical extractions)

These modules were carved out of `manga_translator.py` (the ~3000-line god object) by the
tech-debt decomposition (#187 stage orchestrators, #188 model lifecycle). Each is a
**byte-identical** extraction proven by characterization tests; `manga_translator.py` now
**delegates** to them. **Revert hazard (uniform):** re-syncing `manga_translator.py` from
upstream drops the delegation imports → `ImportError`, and re-importing upstream deletes the
module → the extracted logic *and its preserved landmines* vanish. Per-seam interface + the 16
preserved landmines: `docs/research/mit-core-decomposition-analysis.md`; status + landmine list:
`docs/reports/mit-refactor-progress.md`.

Pure / value (no ML imports, unit-tested in <1s):
- `region_filter.py` (S1) — `filter_translated_regions` (3-way filter dedup).
- `region_apply.py` (S2) — `apply_translations` (zip-truncation **L10**), `apply_render_casing`, `apply_original_as_translation`.
- `prev_context.py` (S6) — `build_prev_context` (per-mode index policy; **L7** first-match).
- `context_counts.py` (S7) — `context_page_counts` log accounting.
- `dictionary.py` (S8) — `load_dictionary` / `apply_dictionary` / `apply_post_dictionary` (re-exported for `__main__`).
- `punctuation.py` — `correct_punctuation` (source-style quote/bracket restore).
- `translation_checks.py` — `check_repetition_hallucination` + `check_target_language_ratio` (#109).
- `translator_chain.py` (#192a) — `TranslatorChain` parse. · `config.py::parse_and_validate_config` (#192) — the single config parse/validate seam (Pydantic-v2 `model_validate_json`) every endpoint shares, replacing 11× scattered `Config.parse_raw` (load_dotenv extraction deferred: import-order risk > ROI; the remaining bare-excepts are intentional broad catches, not debt). · `line_break.py` (#180) — Knuth-Plass packer, now wired behind the **#186 `LineBreaker` seam** (`KnuthPlassLineBreaker`, opt-in; #180 step 2 = select it behind `render.bubble_area_fit` + E2E).

Stateful / async-orchestration (self-bound deps passed as callbacks; characterized via `asyncio.run`):
- `model_usage_tracker.py` (S3) — `ModelUsageTracker` TTL timestamps (**L1** key-drift preserved).
- `model_unloader.py` (S4) — `ModelUnloader` routing table (**L1** unknown-key no-op).
- `memory_guard.py` (S5) — `release_memory` (gc + `empty_cache`).
- `model_reaper.py` (S20) — `ModelReaper` TTL loop (opt-in `.stop()`, **L13/L14**).
- `model_lifecycle.py` (S21) — `ModelLifecycle` facade (preload ×2 fold + `ensure_running`, **L16**).
- `dispatch_registry.py` (S22) — `DispatchRegistry(registry, kind)` folds the byte-identical get/cache/unload trio across all **6** dispatch modules (detector/ocr/inpainter/upscaler/colorizer/translators); each wires `get_X = reg.get` / `unload = reg.unload` and keeps its own divergent `prepare`/`dispatch`. **#188 global `MODEL` killed** in detection — `det_batch_forward_default(batch, device, model)` threads the net explicitly, `craft`'s dead global deleted (no module-level `MODEL` left). `if not cache.get` re-create quirk + `','.join` ValueError message preserved. Closes the #188 model-lifecycle half (translator `BaseGPTTranslator` half still open).
- `none_translator.py` (S9) — `apply_prep_manual_override` (**L12**) + `stamp_none_translations` (**L3**).
- `translation_store.py` (S10) — `read`/`write_translations` (**L2** `exit(-1)` + the cp1252 latent encode bug preserved).
- `image_debug_context.py` (S11) — `ImageDebugContext` (result_path + MD5 swap closures → `with_context`).
- `pipeline_params.py` (S12) — `apply_global_settings` (`_MODEL_DIR` + TF32) **+ `PipelineParams.from_params` value-object** (device/`using_gpu`/gpu-limited/cuda-raise + `batch_concurrent` auto-disable + field parsing; byte-identical, `parse_init_params` delegates). **Closes #187** (the last of the S1-S26 seams).
- `detection_postproc.py` (S13) — `merge_sfx_detections` + `textline_aabb` (#168 second pass).
- `translation_memory.py` (S16) — `TranslationMemory` (two cross-page lists + `reset`; **L9** bleed boundary explicit).
- `gather_per_context.py` (S19) — `gather_per_context` (per-exception keep-original placeholder).
- `text_translation_dispatcher.py` (S17) — `build_chatgpt_translator` + `dispatch_translate` (construction-order split; result_path direct/swap preserved).
- `post_translation.py` (S18) — `apply_post_translation_processing` (punct + post-dict + phase-1 repetition retry) **+** the three phase-2 retry loops `single_` / `concurrent_` / `batch_lang_check_retry`. The loops are **NOT unified**: their `min_ratio` (0.5/0.3), region thresholds (≥6 / >10) and collect/reassign strategies (pad+enumerate / filter+text_idx / cross-context region_mapping) are load-bearing (**L6/L8**) and pinned as per-scope params. The single driver's own phase-1 variant stays inline (different logging/error-handling — a flagged change for later).
- `stages.py` (S15) — the six leaf stage adapters (`run_colorizer`/`run_upscaling`/`run_detection`/`run_mask_refinement`/`run_inpainting`/`run_text_rendering`): the `read ctx-subset → dispatch_* → return value` core of the `_run_*` methods, so the many-arg `dispatch_*` calls (detection = 12 positional) are unit-testable by stubbing. The driver keeps each stage's `time.time()`+`touch()` instrumentation and delegates. **L15** (`**ctx` splat into `dispatch_colorization`) and **L5** (always-None `render_mask`) preserved. Groundwork for the StageRunner (S23).
- `debug_sink.py` (S14) — the verbose debug-image save bodies (`input`/`mask_raw`/`bboxes_unfiltered`/`bboxes`/`inpainted`/`final`.png; verbose guard stays at call sites), the inpaint-preview pair (`save_inpaint_preview` **unguarded** single-driver vs `save_inpaint_preview_guarded` batch — divergence pinned as two functions; preview render passed in as a callback, no ML imports) and the `ocr_debug_dir_env` context manager (`MANGA_OCR_RESULT_DIR` set/restore + 3-branch ocrs/ dir). Leaves exactly **one** `cv2.imwrite` in the god object: the **L11** streaming-placeholder branch (flow control, `_is_streaming_mode` set nowhere in-repo).

Patch render path (S24, were byte-identical extractions — now carry an intentional divergence):
- `patch_geometry.py` (S24a) — pure crop/mask geometry (`build_local_region` / `create_text_only_mask` / `crop_mask_for_patch`). **#248 divergence (no longer byte-identical with upstream's full-page path):** `crop_mask_for_patch` mask resize `INTER_LINEAR`→`INTER_NEAREST` (a binary mask must not be bilinear-fattened then re-binarized) + new `union_refined_with_fallback(refined, text_only)` — keeps the tight CRF mask everywhere it has coverage and falls back to the dilated `text_only_mask` only in connected components the refinement missed, so LaMa stops re-synthesising a halo of clean background around every glyph. `test/test_patch_geometry.py`.
- `patch_renderer.py` (S24b) — `translate_patches` per-group async render driver. **#248:** the refinement-success mask branch now calls `union_refined_with_fallback(refined, text_only_mask)` instead of `cv2.max(refined, text_only)` (dropped the now-unused `cv2` import). **Revert hazard:** the blocky `text_only` halo returns → LaMa over-erases screentone/line-art next to bubbles.

### `server/` — modified (5)

| File | What we changed | Why |
|------|----------------|-----|
| `instance.py` | removed unused batch send methods; lock released before waiting in `find_executor`; `sent_patches` threads `progress_meta` to the worker | #106 contention; live progress UX |
| `main.py` | `/ready` (probes worker `/health`); batch endpoint gained webhook fire-and-forget mode (202 + `run_batch_with_callbacks`); `/cancel/{taskId}`; `safe_result_folder` path guard; worker always binds 127.0.0.1; removed legacy batch endpoints; **#193** `--start-instance` worker lifecycle — startup port-collision pre-check (fail loud, not hang) + `atexit` & `__main__` finally orphan cleanup (uvicorn overrides our signal handlers) + front/worker PID logging, delegating to `worker_lifecycle.py` | #100 #101 #102 #103 #106 + 2026-06-06 incident + #193 |
| `myqueue.py` | single-image tasks only (no disk offload, no `BatchQueueElement`); `QueueElement.progress_meta` | batch moved to `batch_runner`; live progress UX |
| `request_extraction.py` | `requests` → async `httpx`; dropped `BatchTranslateRequest`/`get_batch_ctx`; `get_patch_ctx` accepts `progress_meta` | async correctness; live progress UX |
| `streaming.py` | 300s stream timeout + error frame on stall | #106 |

### `server/` — new (6)
`batch_runner.py` (#100 webhook batch loop) · `cancellation.py` (#101) · `path_utils.py` (#102) ·
`readiness.py` (worker liveness, 2026-06-06 incident) · `webhook.py` (#100 signed delivery + retry + dead-letter; plus `send_progress`/`make_progress_hook` — fire-and-forget per-stage progress events the worker posts to the Backend so the Reader can show live pipeline stages; the worker attaches the hook per request in `mode/share.py`, and `batch_runner` passes `progress_meta` per page). ·
`worker_lifecycle.py` (#193 — `port_is_free` / `ensure_worker_port_free` / `terminate_process`; the two-port `--start-instance` lifecycle guards: startup worker-port collision check (fail loud, not hang) + graceful terminate→kill orphan cleanup. Pure stdlib, unit-tested without spawning a worker. **Revert hazard:** drop it and a killed front orphans the worker on `P+1` again, and a busy worker port hangs the front silently).

### Removed — #191 (vendored upstream baggage, ~14.4k LOC)
- **SD/LDM inpainter** — deleted `inpainting/ldm/**` (vendored CompVis LDM ~11.7k LOC), `guided_ldm_inpainting.py`, `inpainting_sd.py`, `sd_hack.py`, `booru_tagger.py` (SD-prompt-only), the 2 `guided_ldm_inpaint*_v15.yaml`; dropped `Inpainter.sd` (enum + `INPAINTERS`), the `<option value="sd">` web-UI entry, and `open_clip_torch` (SD-exclusive dep). `lama_large` is the production inpainter; the roadmap (MangaTranslator) uses Flux via `diffusers`, not the vendored LDM.
- **ctd / vendored YOLOv5** — deleted `detection/ctd.py` + `detection/ctd_utils/**` (~2.3k LOC incl. GPL YOLOv5); dropped `Detector.ctd` (enum + `DETECTORS`). `default`(DBNet)/`dbconvnext` are the production detectors; the roadmap uses ultralytics YOLOv8+ (already partly in via #168/#170).
- Byte-identical for the production path (Backend sends `lama_large` + default/dbnet; `Inpainter.sd`/`Detector.ctd` were never sent). `test/test_registry_trim.py` pins the trim. **Revert hazard:** re-syncing inpainting/detection `__init__` from upstream reintroduces the deleted keys → `ImportError` on the now-absent modules.

---

## 6. Consolidated foot-guns (things that look safe to change but are not)

1. **Never re-sync a §5-listed file from upstream without re-applying our delta** — every entry
   exists because something broke in production.
2. `ctx.textlines` is reassigned three times; `ctx.mask` is `None` until mask refinement —
  always guard.
3. Mask values must be binary 0/255 before inpainting.
4. `kernel_size` must stay odd (cv2 structuring element).
5. `_PATCH_CONCURRENCY=0` deadlocks the patch loop; keep ≥1.
6. PNG encode returns `None` on timeout — patch loop must (and does) tolerate a missing patch.
7. The lang-ratio check is page-level and gated at ≥6 regions — lowering the gate re-introduces
   #109 false failures on sparse pages.
8. Worker must keep binding 127.0.0.1 — its pickle endpoint is remote code execution by design
   (#103).
9. Thai wrapping must go through `_safe_char_split()`; plain `list(word)` orphans combining
   marks.
10. `translate_patches` must keep calling `reset_page_context()` first (guarded by
    `test/test_page_context.py`) until the #140 Translation Session lands.
11. **`MIT_SFX_DETECTOR=1` (#168) detects stylized SFX but does NOT translate the big ones** — the
    AnimeText YOLO finds them and dedup is clean, but the 48px line-OCR can't read a giant stylized
    glyph (e.g. ぬ): it returns garbage at prob 0.03–0.08 → below the floor → the SFX textline is
    dropped before render. Small SFX that the OCR *can* read (e.g. フッ→"Heh.") work. Reading large
    stylized SFX needs a VLM OCR (MangaTranslator uses `paddleocr-vl`); PaddleOCR-VL-1.5 is blocked on
    transformers 4.55-vs-5.9 incompat (see `DONE.md` 2026-06-12 / `BENCHMARK.md`). Don't assume
    enabling the SFX detector alone yields ぬ→LOOM.
