# MIT Optimization & Performance Reference

> **What this is.** A durable, code-grounded map of where MIT's image-translation pipeline actually spends time, which optimizations survived adversarial review, and which invariants a future developer must not break. Read this before you build a feature that touches the render/merge path or before you chase a "MIT is slow" report — so you don't re-scan the whole server every time.
>
> **Status.** Last full scan **2026-07-02/03**. Timing anchored to real per-stage E2E measurements (`docs/reports/2026-07-02-mit-speedup-study.md` + `-e2e-measurements.md`). Complements — does not duplicate — `ARCHITECTURE.md` (structure), `PIPELINE.md` (stage-by-stage behavior), `CONTRACT.md` (wire shapes), `BENCHMARK.md` (how to measure), `mit-refactor-progress.md` (#187/#188 decomposition seams).
>
> **How to use it.** Start at *Performance picture at a glance* to see what is worth touching. Each subsystem section lists only optimizations that **survived** adversarial verification (verdict keep / keep-with-caveat / measure-first). Rejected ideas are collapsed into a one-line "Rejected" note per subsystem so nobody re-proposes them. Every claim cites `file:symbol`; every unproven gain is flagged `needs_measurement`.
>
> **The single most important caveat.** The render `layout_fit` phase is a **measured** 12-14s bottleneck (confirmed by the `[timing-render]` phase split). But *why* those 12-14s are spent — inside `calc_horizontal` — is **still hypothesis**. Every arithmetic attempt to reconstruct 12-14s from the identified sub-costs (hyphenator ctor, newmm tokenize, per-char width sum) falls short by an order of magnitude. **Do not implement any layout_fit optimization before instrumenting `calc_horizontal` internals and call-counts** (see *Measure-first backlog* #1). The bottleneck is real; its mechanism is not yet proven.

---

## Performance picture at a glance

Per-page wall-clock on a typical interactive single page is ~15-40s. Ranked by measured cost:

| Rank | Subsystem | Measured cost | Confidence | Nature | Priority |
|------|-----------|---------------|------------|--------|----------|
| **1** | **Render — layout_fit** (`resize_regions_to_font_size` → `fit_font_size`/`squeeze_width` → `calc_horizontal`) | **12-14s for a single hard-to-fit region** | Measured (phase split); **mechanism = hypothesis** | Pure CPU we own | **TOP — but instrument first** |
| **2** | **textline_merge** (O(n²) shapely all-pairs) | 0.7s sparse → **10.2s dense/SFX** | Measured | Pure CPU we own; deterministic | **Secondary — real, tractable** |
| 3 | Translation (external LLM RTT) | 2.8-4.3s/page | Measured | Pure network wait | Minor; hide via overlap only |
| 4 | OCR (Model48pxOCR beam search) | ~2s/page | Measured | GPU, sequential decode | Minor |
| 5 | Detection (DBNet R34), warm | 1.2s warm | Measured | GPU forward | **Parked (warm)** |
| — | Detection, **cold-start** | 4.4s once/worker | Measured | One-time init | Minor, one-time |
| **—** | **Inpainting (LaMa-large)** | **~0.3s, stable** | Measured | GPU | **PARKED — do not optimize** |
| — | Render — raster_loop (glyph draw + 4× supersample downscale) | ~1s | Measured (phase split) | GPU/CPU | **PARKED — not the cost** |
| — | Transport (pickle/aiohttp loopback, base64, JSON) | single-digit % of page | Estimated | IPC/serialize | Parked per-op; see structural ceiling |

**Explicitly parked — do not spend effort here:**
- **Inpainting** is ~0.3s and two orders of magnitude below the bottleneck. Every inpaint optimization was rejected (see Inpainting section). It is already cheap because the model is resident (no reload), LFU spectral branch is disabled, MPE BFS loop is off for `lama_large`, and `full_page_inpaint` amortizes to one forward. Leave it.
- **Render raster_loop / 4× supersampling** is ~1s. The 4× supersample is per-region *inside* the cheap loop, not a separate cost. Do not chase it.
- **Warm detection** (1.2s) — reverting the `detection_size=2560` recall knob or fp16-casting the forward were all rejected as quality regressions for sub-second gains.

**Structural ceiling (transport):** even a 2× layout_fit win leaves N pages **serialized on one GPU worker** (single busy-flag executor; `server/instance.py:Executors`). The per-group `asyncio.gather` inside `translate_patches` is **largely illusory** — `_run_text_rendering` → `dispatch()` is `async def` with a fully synchronous body, so the first group's 12-14s `layout_fit` blocks the whole event loop. Raising true concurrency requires a second worker *process* (GIL + module-global font state block in-worker threading), gated by VRAM.

---

## 1. Render — layout_fit (THE bottleneck)

**Purpose.** For each translated region, choose a font size + wrap column and place an axis-aligned destination box so text fills its balloon without clipping/overlap. Pure synchronous CPU, no ML, runs before the cheap raster loop.

**Key files.**
- `rendering/__init__.py:resize_regions_to_font_size` — per-region dispatcher + O(n²) anti-overlap territory build (the hot loop)
- `rendering/__init__.py:_bubble_fit_layout` — orchestrates `fit_font_size` + `squeeze_width`; owns the `measure`/`measure_h` closures
- `rendering/__init__.py:_clean_layout_dst` — narration/caption path
- `font_fit.py:fit_font_size` — integer binary search, ~8 iters, 2 `calc_horizontal` per iter
- `render_overlap.py:squeeze_width` — geometric ×0.9 width narrowing, ~10-20 `calc_horizontal` calls
- `rendering/text_render.py:calc_horizontal` — **the per-iteration cost**; re-runs `_insert_thai_word_breaks` (pythainlp newmm) + `_insert_cjk_word_breaks` + `_split_into_syllables` + `select_hyphenator` on the same text every call
- `rendering/text_render.py:select_hyphenator` — constructs `hyphen.Hyphenator(lang)` uncached; **returns `None` early for Thai** (not in `HYPHENATOR_LANGUAGES`)

**Hot path.** `resize_regions_to_font_size` → per region `_bubble_fit_layout` → `fit_font_size` binary search (each `measure(size)` = `calc_horizontal` for the block **and** `_longest_word_w` = a second `calc_horizontal`) → `squeeze_width` geometric loop (each `measure_h` = one `calc_horizontal`). Net ~30-50 `calc_horizontal` calls on the *same text* per hard region.

**Perf profile.** `[timing-render] phase=layout_fit` dominates; `phase=raster_loop` ~1s. The binary search is clean (~8 iters, no thrash) and the O(n²) territory pass is trivial stdlib geometry (microseconds). The cost is the **constant factor of `calc_horizontal` × ~30-50 calls**. **But the identified per-call sub-costs do not arithmetically reach 12-14s** — the adversarial pass debunked the two headline hypotheses:
- `select_hyphenator` ctor: **no-op on the primary EN→TH path** — Thai isn't hyphenatable so it returns `None` after a cheap list scan (`text_render.py:628-640`). Only bites EN-target (JP→EN) renders, and even there ~60 dict loads ≈ 1-2s, not 12-14s.
- `_insert_thai_word_breaks` (newmm): pythainlp caches its Trie as a module singleton, so calls 2..N don't reload — each is single-digit ms over a short bubble string. Saving ~29 of them removes tens of ms, not seconds.

**Conclusion: the true mechanism is unattributed.** It is likely the sheer call count × per-char width summation (`get_string_width` → `get_char_offset_x`), the `_split_into_syllables` greedy loops, or a far higher call count than assumed. **Instrument before optimizing** (backlog #1).

### Surviving optimizations

| # | Mechanism | Gain | Effort | Risk | Parity | needs_measurement |
|---|-----------|------|--------|------|--------|-------------------|
| L1 | **Memoize `_insert_thai_word_breaks`/`_insert_cjk_word_breaks` by text** — same `region.translation` across all ~30-50 fit iters; cache keyed on raw text so newmm/jieba run once/region (`text_render.py:855-856`) | Tens of ms/region for TH; more if call count is higher than modeled | trivial | low | none (pure fn of text) | **yes** |
| L2 | **Memoize `select_hyphenator` by standardized lang tag** — `Hyphenator(lang)` built once/process (`text_render.py:628`). `.syllables()` is stateless so sharing is safe | Real only on **EN-target** renders (~1-2s there); **~0 for TH** | trivial | low | none | **yes** |
| L3 | **Precompute size/text-invariant prep once per `_bubble_fit_layout`** and feed `calc_horizontal` a fast path (only re-run width-dependent greedy pack) | Cuts repeated segmentation across ~15 squeeze + ~8 fit iters | medium | medium | **possible** | **yes** |

**Caveats that gate L1-L3:**
- **Parity landmine on any cross-iteration cache:** `calc_horizontal` reads a **module-global font** (`set_font`, `text_render.py:299`). #176 resolves per-region fonts. An `lru_cache` keyed on `(text, font_size)` that omits the active font id returns SFX-font widths for a dialogue region → silently wrong wrap. **Safe only within one region where the font is fixed**, or the key must include the font identity.
- **L3 premise is partly false:** syllables are *not* width-invariant during squeeze — `_split_into_syllables` (`text_render.py:665,690`) further splits any syllable wider than `max_width` via `_safe_char_split`, and `calc_horizontal`'s height-overflow auto-grow loop (`text_render.py:867-876`) mutates `max_width`. A naive hoist freezes syllables at one width and breaks the **#183 no-force-break contract** (`HMPH`→`HM/PH` regression, guarded at `rendering/__init__.py:111`). L3 must re-run the `max_width`-dependent syllable normalization; it is not a clean invariant hoist.

**Rejected (do not re-propose):**
- *Binary-search `squeeze_width` instead of ×0.9* — the ×0.9 walk is **already logarithmic** (~13 steps); binary search is a ~1.6× constant win at best, and `measure_h` is a **step function with plateaus** so the ≤box_h predicate settles on a different width → different render. **Parity break** on the DECIDED narrow-column surface (`used_w` sets rendered geometry, `rendering/__init__.py:130-132`).
- *Drop the second `calc_horizontal` in `measure()` / use `get_string_width` for `_longest_word_w`* — **not byte-identical:** feeding `_longest` back through `calc_horizontal` re-runs `_insert_thai_word_breaks`, which can re-segment the token into sub-words so the returned width < `get_string_width` → flips the reject test at `rendering/__init__.py:111` at boundary sizes → different accepted font. Gain evaporates once L1/L2 cache `_longest_word_w` anyway.
- *Re-enable `get_char_offset_x` lru / blanket `calc_horizontal` lru / cache stroke bitmaps* — negligible (underlying `get_char_glyph` is already `lru_cache(1024)`); probes use distinct sizes/widths so exact-key repeats are rare; stroke caching lives in the ~1s raster loop.
- *Hoist anti-overlap territories out of per-region branches* (`rendering/__init__.py:326-386`) — **not a perf item** (O(1) box arithmetic, microseconds even at n=50). Legitimate only as readability cleanup, and it touches the #436-gated `continue` branches, so not risk-free.

---

## 2. textline_merge (secondary, tractable, deterministic)

**Purpose.** Group per-textline OCR quads into coherent regions (bubbles/SFX) before translation. Builds a merge graph over textline pairs, splits over-merged components via an MST deviation test, emits ordered regions.

**Key files.**
- `textline_merge/__init__.py:merge_bboxes_text_region` — step-1 all-pairs O(n²) graph build (the hot loop) + region assembly
- `textline_merge/__init__.py:split_text_region` — recursive MST-based over-merge splitter (complete graph per component)
- `utils/generic.py:quadrilateral_can_merge_region` — per-pair predicate: builds **two fresh shapely `Polygon`** + GEOS `.distance()` **before** any cheap scalar gate (`generic.py:656-666`)
- `utils/generic.py:Quadrilateral.aabb` — already a `cached_property` (`generic.py:441-446`)
- `detection_postproc.py:merge_sfx_detections` — #168/#278 appends many `is_sfx` quads, inflating n

**Hot path.** `itertools.combinations(enumerate(bboxes), 2)` → `quadrilateral_can_merge_region` for every pair; each call constructs two throwaway `Polygon`s and runs exact GEOS distance *before* the gap reject. `split_text_region` adds a per-component complete-graph MST whose edges each build several `MultiPoint.convex_hull` in `distance_impl`.

**Perf profile.** Confirmed **secondary** bottleneck. Deterministic (`combinations`/`kruskal`/`connected_components` are order-stable) → **characterization snapshots of `region_indices` are valid** even though upstream OCR/LLM are not. **No standing per-stage timer exists** — add `perf_counter` + `len(ctx.textlines)` around `dispatch_textline_merge` in `manga_translator.py:_run_textline_merge` (backlog #2).

### Surviving optimizations

| # | Mechanism | Gain | Effort | Risk | Parity | needs_measurement |
|---|-----------|------|--------|------|--------|-------------------|
| **M1** | **AABB-gap pre-reject before any shapely** — `aabb⊇polygon` ⇒ `dist(aabbs) ≤ dist(polygons)`, so if `aabb_gap > discard_connection_gap·char_size` the pair provably can't merge; return `False` on cached-float math before building `Polygon` (`generic.py:656-666`) | Large on the *scattered* dense case; **weak when boxes collapse into one big component** (then `split_text_region` dominates, untouched) | small | low | **none** (byte-identical reject) | yes |
| M2 | **Reorder cheap scalar gates ahead of the GEOS distance** — hoist `font_size_ratio_tol`/`aspect_ratio_tol` (`generic.py:668-673`) above the `Polygon`+distance; all gates are side-effect-free early-return-`False` | Small; complements M1 on size/aspect-incompatible near pairs | trivial | low | none | yes |
| M3 | **Precompute raw 4-point `Polygon` once per box** (cache `Polygon(self.pts)`, **not** `.polygon` which is convex hull) | Subsumed by M1 for far pairs; small residue | small | medium | none (if raw pts, not hull) | yes |
| M4 | **Pathological-n guard / coarse spatial bucketing** above ~100-150 boxes; cell size from **max font_size present** (radius is per-pair) | O(n²)→~O(n) on the exact 10.2s pages; none on sparse | medium | medium | **possible** | yes |
| M5 | **shapely-2.x STRtree candidate query + vectorized distance** — gate behind M4's threshold (index build loses below ~n=100) | Largest at high n; same win M1 already captures at 5% effort | large | high | **possible** | yes |

**Caveats:**
- **M1 magnitude is regime-dependent:** on a page where boxes *collapse* into one component, the cost moves to `split_text_region`'s complete-graph MST (`__init__.py:42-69`, `distance_impl` builds 2-3 convex hulls/edge) which M1 does **not** touch. "10.2s → sub-second" over-claims that regime.
- **M4/M5 prune radius must be a proven upper bound** on `quadrilateral_can_merge_region`'s acceptance (scales with `char_gap_tolerance2 × font_size`, involves rotated/vertical quads an axis-aligned grid can misjudge). Drop one valid merge → different region grouping → **different text handed to the translator = semantic change**, not a px shift.
- **M5 determinism hazard:** `STRtree.query` returns tree order, not `combinations` order; edge-insertion order feeds kruskal tie-breaking and `connected_components` iteration — the stable order that makes snapshots valid. Re-sort candidates to canonical pair order or snapshots drift.

**Rejected:** *Reuse step-1 predicate edges as the split MST candidate set* — **direct parity break.** `split_text_region` computes `distances_mean`/`std`/`std_threshold` over the **complete-graph** MST weights (`__init__.py:50-54`) and gates the split on them; a sparser edge set changes mean/std → different split verdict → different region membership → different translation input and layout. Step-1 also used a different predicate than split's `distance_impl`.

---

## 3. OCR (per-line recognition + VLM SFX rescue)

**Purpose.** Recognize text (+ per-char fg/bg color) in each textline crop. Default `Model48pxOCR` (ConvNeXt+Roformer, autoregressive beam search). MangaDock adds a vision-LLM "SFX rescue" (#168/#278) for stylized glyphs line-OCR drops.

**Key files.**
- `ocr/model_48px.py:OCR.infer_beam_batch_tensor` — vectorized batched beam search (the ~2s loop)
- `ocr/model_48px.py:Model48pxOCR._infer` — crop→48px, sort-by-width, chunk(16), batch decode
- `ocr/common.py:CommonOCR._generate_text_direction` — **O(n²) `itertools.combinations`** direction graph (same shape that blows up textline_merge; runs here too, before decode)
- `ocr_vlm.py:vlm_localize_sfx` — **synchronous `requests.post`** (`ocr_vlm.py:179`) inside the async region loop
- `manga_translator.py:_run_ocr` (L634) + SFX-rescue block (L786-816)

**Perf profile.** ~2s/page — **minor**. Cost is the autoregressive decode: up to `max_seq_length=255` sequential GPU steps over N×`beams_k`(5) hypotheses in fp32. Deterministic beam path → **offline stage A/B is valid** despite pipeline non-determinism.

### Surviving optimizations

| # | Mechanism | Gain | Effort | Risk | Parity | needs_measurement |
|---|-----------|------|--------|------|--------|-------------------|
| O1 | **Make SFX VLM rescue non-blocking/concurrent** — collect rescue-eligible crops, fire via `asyncio.gather`/`run_in_executor` (same calls, same output) | N serial RTTs → ~max(1-2s) **on SFX-dense pages with `vlm_rescue=True`** | medium | low | **none** | yes |
| O2 | **Keep `ocr48px` the default / port the tensor decoder if changing** — guardrail, not a gain | Avoids multi-fold regression | — | — | none | no |
| O3 | Right-size `max_seq_length` (255→~64) at `model_48px.py:120` | Cuts per-step full-depth `index_select` copy width ~4× (mem bandwidth, not GPU compute); ~0 on clean pages (early `break` at :763) | trivial | medium | **possible** (truncates legit >64-tok lines) | yes |
| O4 | fp16 autocast on the OCR forward | ~1.2-1.4× on the compute-bound backbone/encoders only; decode loop is launch-bound → little | medium | medium | **possible** (topk can flip on near-ties) | yes |
| O5 | Raise `max_chunk_size` (16) when VRAM permits | Indeterminate — wider padding fights batch efficiency | small | medium | none | yes |

**Caveats:**
- **O1 is default-off:** `vlm_rescue=False` (`config.py OcrConfig`) and gated tightly by `should_rescue_sfx`. Zero benefit on the default path; concurrent calls hit the **same gateway** as translation (rate/contention). Must preserve region↔rescued association so `restore_sfx_translations` (`manga_translator.py:938`) stays correct.
- **O2 is a latency guardrail, not "never evaluate another recognizer":** the legacy engines (`model_32px`/`model_ocr_large`/`model_manga_ocr`) use `Hypothesis.extend` which clones the full `cached_activations` list per token (`model_48px.py:458-464`) → several-fold slower. Alternatives exist for accuracy on some scripts.
- **O3/O4 are parity items:** OCR output is byte-load-bearing into textline_merge grouping + translation. Characterize offline on fixed regions.

**Rejected:** *Build the per-step remaining-index tensor once* (`model_48px.py:767-772`) — the block is skipped by `continue` at :743 whenever nothing finished, tensors are <80 int64, gain is sub-millisecond on a 2s stage, and it edits the fragile finished/remaining index arithmetic that mis-attributes beams if broken. The '1.5GB/chunk' figure that motivated it was ~10× wrong (`[80,6,255,320]` fp32 ≈ 157MB).

**SFX rescue landmine:** the rescue *depends* on line-OCR dropping stylized glyphs. "Improving" OCR to read an SFX as ASCII makes `ocr_read_real_text()` true and **drops the region as a #278 false-positive** (`manga_translator.py:814`). Don't tune OCR to read SFX without revisiting the gate.

---

## 4. Translation (external LLM, `custom_openai` active)

**Purpose.** OCR'd textlines → target strings via an OpenAI-compatible chat LLM (`CustomOpenAiTranslator`, the 9arm/ollama gateway). One `<|n|>`-tagged batched request per page + a QA/retry tail.

**Key files.**
- `translators/custom_openai.py:_translate` / `_request_translation` / `_assemble_prompts` — the active per-page loop; splits into serial chunks only when >4096 chars
- `translators/config_gpt.py:ConfigGPT.chat_system_template` — appends series(#157)+prev(#159) context **into** the system template (prefix-cache killer for custom_openai)
- `manga_translator.py:_retry_translation_with_validation` (L1996) — one **full-RTT single-text dispatch per failed region**, serial

**Perf profile.** 2.8-4.3s/page of **pure network wait** — minor, but the cheapest second to hide via overlap. Token overhead (a ~600-token 3-step system template re-sent every request) is the other lever but **unmeasured** — `token_count` records only `total_tokens`. Non-determinism (temp=0.5) → per-stage timing only.

### Surviving optimizations

| # | Mechanism | Gain | Effort | Risk | Parity | needs_measurement |
|---|-----------|------|--------|------|--------|-------------------|
| **T1** | **Log `prompt_tokens` vs `completion_tokens`** separately (`response.usage`, currently only total at `custom_openai.py:241-242`) — de-confounds every token-oriented idea before investing | 0 runtime; unblocks T2/prompt work | trivial | low | none | no (but sanity-check the gateway populates the split) |
| T2 | **Batch post-check retries into one `<|n|>` call + send multi-chunk prompts concurrently** (`asyncio.gather` the serial loop at `custom_openai.py:125`) | Concurrent-chunk half saves (N-1)×RTT **only on >4096-char pages**; zero on common single-chunk page | small | low | **concurrent-chunk: none; retry-batch: possible** | yes |
| T3 | Restore prefix caching for custom_openai — keep `chat_system_template` context-free, push `prev_context` as a separate trailing message (mirror `chatgpt.py:687-688`) | Prompt-token billing (irrelevant for self-hosted gateway) + *maybe* TTFT if gateway does multi-slot prefix KV reuse | small | low | **possible** (changes bytes/message structure sent) | yes |

**Caveats:**
- **T2 retry-batch is *not* parity-none:** batching M failed regions changes the per-region context (batched neighbours vs isolated) → different retried translations, unverifiable under non-determinism. The concurrent-chunk half *is* parity-safe (independent requests, index-ordered).
- **T3 helps little on this deployment:** self-hosted ollama has a single most-recent-prefix cache, and #159 changes `prev_context` every page anyway; billing savings are moot without per-token cost.

**Rejected:** *Overlap mask+inpaint with the translation wait* — ceiling is ~0.3-0.8s hidden under a 3s wait (2-4% of page) and it forces inpainting the pre-filter (larger) mask → parity change (mask refinement is **deliberately** sequenced after translation, `manga_translator.py:530`). *Shrink the system prompt* — a translation-quality experiment (parity:yes), latency is completion-token-dominated. *Loosen the 40 req/min ratelimit* — no-op on the single-page path (first request sleeps 0), and on a single-GPU gateway removing client spacing just moves the queue server-side. *Second worker preload parallelization* — cold-start only, VRAM-dangerous.

---

## 5. Detection (DBNet R34 + #168 SFX pass)

**Purpose.** Page RGB → (textline quads, text mask). Default DBNet ResNet34 at `detection_size=2560`, optional AnimeText-YOLO SFX second pass (#168).

**Key files.** `detection/default.py:DefaultDetector._infer` (DEFAULT path; **byte-identical copy** in `dbnet_convnext.py`), `det_batch_forward_default` (fp32 GPU forward), `common.py:CommonDetector.detect`, `sfx_detector.py:detect_sfx_boxes`, `config.py:DetectorConfig` (`detection_size=2560`, MangaDock override of upstream 2048).

**Perf profile.** Cold 4.4s → **warm 1.2s**. Minor and mostly one-time. Deterministic given fixed input. `cudnn.benchmark` is deliberately **False** (only `allow_tf32` set in `pipeline_params.apply_global_settings`) because `resize_aspect_ratio` pads to `MULT=256` → many distinct shapes; flipping benchmark on re-autotunes per shape.

### Surviving optimizations

| # | Mechanism | Gain | Effort | Risk | Parity | needs_measurement |
|---|-----------|------|--------|------|--------|-------------------|
| D1 | **Warm-up dummy forward at `_load`** to move cudnn/cublas init off the first page | ~3s off first-page latency **only if load happens before `/ready` accepts traffic** | small | low | none | yes |
| D2 | **Warm-up the #168 YOLO at load when `det_sfx=True`** | One-time cold-start off the first SFX page | small | low | possible (imgsz is a recall knob) | yes |

**Caveats:**
- **D1 relocates, doesn't remove:** MIT's `/ready` returns 503 until the model loads (project memory), so pushing first-forward init into `_load` just delays readiness ~3s unless the server pre-warms *before* accepting traffic. Cold-start was never decomposed into `torch.load`-from-disk vs first-forward init — if disk load dominates, a dummy forward saves nothing (backlog #4). Must be duplicated into **both** byte-identical backbones.
- **D2 is default-off** (`det_sfx=False`); the real per-SFX-page cost is textline_merge (10.2s), not the YOLO forward.

**Rejected:** *Move `bilateralFilter` after downscale* — perf model is backwards: `resize_aspect_ratio` *upscales* sub-2560 pages to 2560, so filtering after resize runs on a **larger** image; the only pages that benefit (>2560 long side) take the `det_rearrange_forward` tiling branch that **skips bilateral entirely**. *fp16 autocast* — R34 already runs TF32 on tensor cores (`allow_tf32`), delta is small, sub-second on a non-bottleneck, and fp16 nudges boxes across `box_threshold=0.7`. *Lower `detection_size` to 2048* — a **deliberate small-text recall knob** (landmine: "not a default to clean up"), reverting it is a quality regression for ~0.4s.

---

## Cross-cutting landmines (do not break)

**#187/#188 byte-identical decomposition.** `stages.py` dispatch adapters and `model_*.py` lifecycle helpers were lifted **verbatim**. Do not reorder dispatch args (detection has 11 positional args), change the colorization `**ctx` splat, or "clean up" preserved key drift. Any fix to `_infer` must land in **both** `default.py` and `dbnet_convnext.py`.

**Render-parity is DECIDED** — narrow-column wrap + 4× supersampling + true vertical + SFX #168. Anything that shifts chosen font/width/geometry (`squeeze_width` search granularity, `_longest_word_w` scaling, `used_w`, margins `_FIT_MARGIN 0.92`/`_LINE_HEIGHT 1.2`/`_MAX_FONT_BOX_RATIO 0.5`) is a **parity-impact item requiring explicit sign-off + a characterization test**, never a silent perf edit.

**Non-determinism → no full-run A/B.** OCR-VLM + LLM sampling (temp=0.5) make full-run A/B timing/quality **invalid**. Validate layout_fit/merge/OCR changes via **offline per-stage dumps or characterization tests on fixed inputs**. textline_merge and detection *are* deterministic given fixed input — snapshot `region_indices`/box sets there.

**Module-global font state.** `text_render.set_font` mutates a process-global font; `calc_horizontal`/`get_char_glyph` read it with non-thread-safe `lru_cache`s. **Any threading or cross-region caching must key on / lock the active font** or it silently renders with the wrong face. This is the single biggest blocker to threading render (rejected in orchestration & transport).

**#NNN feature gates that must stay byte-identical when off:** `bubble_fit`/`clean_layout`/`occupancy` (#166/#175/#436), `full_page_inpaint` + `inpaint_context_pad=0` (#249, legacy per-crop), `mask_tighten`/`lama_lum_reground`/`seamless_clone` (#268), `det_sfx`/`det_bubble_seg` (#168/#170), `MIT_CONTEXT_PAGES=0` rolling context (#159). Optimizations must not silently flip these — they change rendered geometry/quality.

**Correctness-affecting (not just perf) knobs.** `full_page_inpaint` gates one-shot-then-slice vs per-crop inpaint; the per-crop path starves LaMa's FFC global branch and leaves gray blobs. Choosing the inpaint path by group count is a **run-to-run parity variance** because group count is non-deterministic.

**Model lifecycle.** `models_ttl==0` has **dual meaning** — eager preload **and** `ModelReaper.reap_once` short-circuit (never unload) → models stay resident on a warm worker. `ModelUsageTracker` key drift (`colorizer`/`textline_merge`/`rendering` have no unload route) is **intentional**; don't "fix" the names. `ModelReaper` background task isn't cancelled by default (leak preserved verbatim).

**In-place mutation / load-bearing copies.** `render()` mutates `img_rgb` in place (#436); `patch_renderer.py` keeps `inpaint_before_text = img_inpainted.copy()` for the content-alpha diff — removing it corrupts alpha. `#250` deep-copies config to floor `font_size_minimum` per-request; mutating the shared config leaks the patch-only floor into single-page render.

**Wire contracts.** `normalize_patch_result` `{x,y,w,h,img_b64}` and `to_json` byte-struct layout are **byte-stable** (Backend overlay + ichigo extension). Don't reorder/rename fields. The `<|n|>` tag protocol (`custom_openai.py:168-206`) — changing prompt format without preserving tags silently misaligns translations to regions.

**Security / process model.** The worker binds `127.0.0.1` only (#103) and `pickle.loads` request bodies — **never expose it off-box** (arbitrary code execution). The single-worker busy-flag is an **isolation guarantee**: `share.py` attaches a per-request progress hook to the shared singleton `_translator`; real in-worker concurrency cross-attributes webhooks and breaks `reset_page_context` (#136 no-bleed). Concurrency must be **per-process (more workers)**, not per-request. `wait_in_queue`'s `finally` always frees the executor even on `CancelledError` (`myqueue.py:112`) — load-bearing; without it an aborted batch deadlocks all future pages.

**Upstream vs MangaDock.** MIT is a fork of manga-image-translator. Upstream verbatim: `calc_horizontal`/`put_char_*`/`add_color`, DBNet forward + `_infer` body, `quadrilateral_can_merge_region`, `ConfigGPT`/`CommonTranslator`/`<|n|>` protocol, the FFC/FourierUnit network. MangaDock-specific (#NNN in comments): `_bubble_fit_layout`/`_clean_layout_dst`/anti-overlap, patches path (`translate_patches`/`PatchRenderer`/`normalize_patch_result`), SFX rescue, webhook/batch/rolling-context, `CustomOpenAiTranslator` wiring. Don't optimize dead upstream paths (`mode/ws.py`, unreachable `translate_batch` from the front).

---

## Reuse notes (primitives worth knowing)

**Geometry / layout (pure, dependency-light, unit-tested in isolation):**
- `render_overlap.py` — `clamp_box_to_neighbors`, `squeeze_width`, `box_containment` (IoA), `processing_scale` (sqrt-megapixel page scaler), `font_bounds`/`bubble_fit_bounds`. No numpy/ML/self.
- `font_fit.py:fit_font_size` — generic "largest integer satisfying an injected `fits()` predicate" binary search; measure-callback seam keeps it renderer-independent.
- `safe_area.py:safe_area_box` — largest centered inscribed box + pole-of-inaccessibility anchor (distanceTransform); reusable for panels/inpaint/watermark placement.
- `bubble_association.py` — `associate_regions_to_bubbles`, `group_regions` (balloon-aware union-find), `union_box`, `balloon_occupancy`. ML-free, <1s tests.
- `utils/generic.py:Quadrilateral` — canonical textline primitive with rich cached geometry (`aabb`, `polygon`=**convex hull** ≠ raw `Polygon(pts)`, `angle`, `aspect_ratio`, `font_size`, `get_transformed_region`). **AABB rect-gap pre-reject** (M1) is a general cheap-before-expensive filter reusable anywhere a shapely distance runs unconditionally.
- `utils/sort.py:sort_regions`/`_sort_panels_fill` — panel-aware manga reading order (swallows exceptions → `_simple_sort` fallback).

**TextBlock caching rules** (`utils/textblock.py`): `xyxy`/`center`/`min_rect`/`unrotated_size` are correctly `cached_property` (lines immutable post-construction). **`direction`/`vertical`/`horizontal`/`alignment` must stay plain `@property`** — `_direction`/`_alignment` are mutated externally after `__init__` (`region_apply.py:36-37`, `none_translator.py:26-27`); only the immutable lines-derived fallback may be cached. `get_font_colors`/`stroke_width` must stay uncached (depend on live fg/bg via `set_font_colors`).

**Model / pipeline scaffolding:**
- `utils/inference.py:ModelWrapper` (`is_loaded()` resident-load guard) + `InfererModule` ABC — declarative `_MODEL_MAPPING`, download/verify(sha256)/load/unload. Extend this base for any new inferer.
- `ModelUsageTracker`/`ModelReaper`/`ModelUnloader`/`ModelLifecycle` — injectable (clock + unload fns) TTL model-lifecycle toolkit, torch-free, unit-testable.
- `DispatchRegistry` — lazy-instantiate-and-cache + unload registry keyed by enum, shared across detection/ocr/inpainting/translators.
- `PatchRenderer.process_group` — the model for a testable region-parallel GPU stage: per-request shared state in the object, GPU semaphore (`PATCH_CONCURRENCY`) gating heavy work while CPU/PNG overlaps.

**Transport / IO:**
- `server/webhook.py` — HMAC-signed delivery + bounded backoff retry + dead-letter + fire-and-forget progress channel; ML-free, <1s tests.
- `server/worker_lifecycle.py` — `ensure_worker_port_free`/idempotent `terminate_process` (pure stdlib) — reuse for spawning a second worker.
- `server/rolling_context.py` — bounded (max_pages + max_chars, oldest-first) cross-page context accumulator.
- `loop.run_in_executor` + `asyncio.wait_for(timeout)` around `encode_patch_png` — the pattern for offloading blocking CPU with a hard timeout.

**Text / LLM:**
- `ocr_vlm.py` — injectable-HTTP (`post_fn`) parse/sanitize/gate pattern; unit-tested with no network. `should_rescue_sfx`/`sanitize_sfx` encode target-language script handling.
- `CommonTranslator._clean_translation_output` — MT sanitizer (whitespace/punctuation + `aaaa`→`aa` collapse). `translation_checks` (`check_repetition_hallucination`, `check_target_language_ratio`) — pure QA verdicts. `ConfigGPT._config_get` — hierarchical per-model config fallback.

---

## Measure-first backlog

Instrumentation still missing to turn hypotheses into numbers. **Do these before writing optimization code.**

1. **[TOP] Attribute the 12-14s inside `calc_horizontal`.** Wrap `select_hyphenator`, `_insert_thai_word_breaks`, `_split_into_syllables`, and the per-char width loop with `time.perf_counter`, and add a **call-counter on `calc_horizontal` per region**. The measured phase split proves `layout_fit` dominates; nothing proves *which* sub-step. Extend the `[timing-render] phase=layout_fit/raster_loop` pattern in `dispatch()`. Until this exists, L1/L2/L3 are unsized guesses (the two headline mechanisms — hyphenator ctor, newmm reload — were already partly debunked).
2. **Add a textline_merge timer.** `perf_counter` + `len(ctx.textlines)` around `dispatch_textline_merge` in `manga_translator.py:_run_textline_merge`, plus a `quadrilateral_can_merge_region` call-counter and a split-vs-merge time split on a dense SFX page. Confirms whether M1 (step-1) or the untouched `split_text_region` owns the 10.2s, and sizes M1's candidate-set reduction.
3. **Log OCR decode step-count vs 255.** Instrument `infer_beam_batch_tensor` with a step counter + phase timer (backbone/encoder vs decode loop) and log actual max decoded length. Sizes O3 (`max_seq_length`) and confirms whether decode is launch-bound (kills O4 fp16 value).
4. **Decompose detection cold-start** into `torch.load`-from-disk vs first-forward cudnn/cublas init. Determines whether D1's warm-up forward saves anything.
5. **Split translation `prompt_tokens` vs `completion_tokens`** (T1) — trivial, and it de-confounds T3/prompt work. Sanity-check the ollama-compat gateway actually populates the split.
6. **Confirm the transport concurrency ceiling.** Wrap `wait_in_queue` dispatch with `perf_counter` (queue-wait vs worker-busy) and log `free_executors()` over a chapter to confirm it never exceeds 1 — and measure peak VRAM + commit-charge headroom before proposing a second worker (project memory: silent MIT death under OSError 1455 when memory is tight).
