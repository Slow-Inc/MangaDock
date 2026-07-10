# How to Make MangaDock MIT Translate Faster — Engineering Study

> **Provenance:** produced 2026-07-02 by a multi-agent `ultracode` workflow (21 agents: ground-truth pipeline map + log-timing extraction → per-stage bottleneck analysis → optimize proposals → adversarial skeptic review → synthesis). Analysis only, no code changed. Evidence discipline enforced: every timing claim tagged MEASURED or HYPOTHESIS.

*Scope: per-page `/translate/with-form/patches` pipeline. The logs carry no per-stage wall-clock, only the `[render]`/`[mask]` tqdm bars, translation token counts, and inpaint/detection resolution lines.*

---

## 1. TL;DR

- **Where the time most likely goes:** Two co-dominant stages. **(a) Text rendering on the 4× supersampling parity path — MEASURED**, the only stage with real wall-clock: ~1.7 s/patch, ~12 s for 7 patches (`reground.log`), vs sub-second-to-~7 s on the ss=1 fast path. **(b) External-LLM translation — HYPOTHESIS**, a serial network round-trip on the critical path emitting 553–1233 tokens/call across up to 40 calls (`s702.log`/`reground.log`), but its wall-clock is **completely uninstrumented**. Inpaint (single full-page LaMa pass, reused across patches) and everything else are almost certainly smaller.
- **Cannot yet call a single "dominant" stage** honestly: render is measured-significant, translation is hypothesis-significant, and we have zero timestamps to compare them. That is the core finding.
- **Single highest-value action (confidence: high that it's the right *first* move, not that it yields speed): add per-stage wall-clock timers** (Section 4). Until then every non-render optimization is unfalsifiable — and MIT translate is non-deterministic (OCR-VLM + LLM sampling), so you **cannot** A/B two full runs to attribute a speedup; only per-stage/offline timing is trustworthy.
- **Highest-value *code* action once instrumented (confidence: medium):** **overlap the LLM translation call with mask+inpaint** (they use disjoint resources — remote network vs local GPU — and neither depends on the other's output until render). This is quality-neutral and can hide the smaller of the two multi-second stages entirely. **Caveat:** the full-page-inpaint branch it overlaps is gated behind `full_page_inpaint` (default off) and shares a mutable `ctx` — see the caveat in Section 3.
- **Do NOT** buy speed by cutting the decided render-parity quality bar (4× supersampling, narrow-column wrap, true vertical, SFX). Any option that lowers ss, detection resolution, inpaint resolution, or OCR beam width is a **quality regression requiring explicit user sign-off**, not a free win (Section 5).

---

## 2. Pipeline timing picture

Order per request: preload → [colorize OFF] → [upscale OFF] → detect(+SFX opt) → OCR → textline-merge(+VLM SFX rescue opt) → pre-dict → **TRANSLATE (external LLM)** → mask-refine → **INPAINT** → **RENDER (+4× SS)** → [downscale opt] → dump.

| Stage | Signal in logs | Timing | Relative cost | Confidence |
|---|---|---|---|---|
| **10. Text render (4× SS path)** | `[render]` tqdm (real wall-clock) | **~1.7 s/patch; 7 patches ≈ 12 s** | **significant / measured-dominant local-compute** | MEASURED, high |
| 10. Text render (ss=1 fast path) | `[render]` tqdm | 1.05–2.85 it/s; 19 patches ≈ 6–7 s | moderate | MEASURED, high |
| **7. Translation (external LLM)** | token counts only (**no latency**) | 553–1233 tok/call, up to 40 calls; **wall-clock UNKNOWN** | **significant (co-dominant, plausibly)** | HYPOTHESIS, medium |
| **9. Inpaint (LaMa-large, full-page, reused)** | resolution line only (**no duration**) | one bf16 forward, ≤2048px long side (e.g. 1536×2048); reused across patches | minor–significant, page-dependent | HYPOTHESIS, medium |
| 8. Mask refinement | `[mask]` tqdm | 104–210 it/s, `[00:00]` sub-second | **negligible (measured)** | MEASURED, high |
| 3. Detection (DBNet-R34, single forward) | resolution line only | one 5.2 MP forward + CPU bilateral(d=17) | minor | HYPOTHESIS, medium |
| 4. OCR (48px beam k=5, chunk 16) | per-line `prob:` (**no time**) | batched 16/chunk, early-stops < 255; ~20–40 lines/page | minor (could rise on long-line pages) | HYPOTHESIS, medium |
| 5. Textline merge (+VLM SFX rescue) | **no log line at all** | O(n²) shapely CPU, n~20–40 → single-digit ms; VLM rescue = external ~1–2 s/region when `det_sfx` on | negligible (merge); rescue significant only when enabled | HYPOTHESIS, high (shape) |
| 6. Pre-dict / 11. Downscale | — | trivial CPU | negligible | HYPOTHESIS |
| 0/1/2. Preload, colorize, upscale | startup warnings only / did not run | cold-start one-time; OFF by default | n/a | uninstrumented |

**Instrumentation gap (be explicit):** the ONLY measured signals are the `[render]` and `[mask]` tqdm bars. Token counts and inpaint/detection resolutions are **size proxies, not time**. Detection, OCR, textline-merge, inpaint compute, and the translation network round-trip have **zero** wall-clock in the logs. Any cost claim for them is HYPOTHESIS.

---

## 3. Ranked optimization backlog (survivors of adversarial review only)

Sorted by expected value (impact × tractability ÷ risk). Options that failed adversarial review are in Section 5. Nearly all need per-stage timing (Section 4) to size or prove — full-run A/B is invalid (non-determinism).

| # | Stage | Action | Expected gain | Effort | Risk | Quality tradeoff | Needs measure first |
|---|---|---|---|---|---|---|---|
| 1 | **all** | **Add per-stage wall-clock timers** (Section 4) | 0% direct; unblocks/falsifies everything | trivial | low | none | — (this IS the measurement) |
| 2 | translation | **Overlap LLM call with mask+full-page-inpaint** (disjoint resources; only render needs the translation) | hides the smaller of {translation, inpaint} — plausibly several s/page | medium | medium | **none** (byte-identical outputs, reorder only) | yes |
| 3 | render | **Cache stroked-border bitmap** per (char, font_size, direction) — re-enable the commented-out `get_char_border` lru_cache as a final uint8 ndarray | removes redundant FreeType Stroker+`to_bitmap` per repeated glyph; byte-identical | small | low | **none** (pure memoization) | yes |
| 4 | render | **Warp into region bbox, not full page** — translate homography by bbox origin, warp into region-sized buffer, blend into slice | per-region warp+alloc O(page)→O(region); notable with many small regions | medium | low–med | **none** (identical interior pixels) | yes |
| 5 | translation | **Concurrent (gather) the post-translation retry tail** instead of N serial per-region round-trips; confirm check-gates only fire on failure | on retry-heavy pages, ~N×RTT → ~1×RTT; ~0 on clean pages | small | low | **none** (same checks/retries) | yes |
| 6 | detection | **Run CPU bilateral(d=17) AFTER downscale**, and/or drop d→7–9 | only helps when source > detect_size (many pages are ~1:1 → ~0); d-drop is a denoise-strength change | small | med | slight detection-accuracy risk (verify box/mask parity) | yes |
| 7 | inpaint | **channels_last + cudnn.benchmark** on LaMa convs | low tens-% on the *conv* branch only (~25%; FFT/`FourierUnit` branch unaffected, forces fp32); benchmark re-tunes per page shape | small | med | none (channels_last identical; benchmark tiny numeric drift) | yes |
| 8 | textline-merge | **AABB gap pre-reject** before shapely, and reorder scalar gates (font_size_ratio/aspect) before polygon build | drops most far-apart pairs to float ops; only matters at pathological n>~150 (SFX-dense) | small | low | **none** (conservative lower bound; also add n>100 guard) | yes |
| 9 | translation | **Verify server-side prefix caching is on** (prefix already byte-stable) + **dedupe identical source strings** per page | prefix: cuts prefill if backend supports it (config check, not code); dedupe: small (intra-page exact dups rare) | small | low | none (prefix); mild (dedupe assumes context-free equivalence) | yes |

**Caveats on the top code option (#2):** (a) the full-page-inpaint branch is gated behind `config.inpainter.full_page_inpaint`, **default off** — on the default patch path inpaint runs per-group inside `PatchRenderer`, so the overlap target may not exist; confirm which path the benchmark uses. (b) The translation task and inpaint branch both **mutate the same `ctx`** (`ctx.text_regions`, `ctx.mask`) — running them via `gather` on one `ctx` is a data race; you must deep-copy `ctx` first (budget that into effort). (c) Gain is bounded by `min(translation, inpaint)`; if the page is render-bound, hiding one behind the other saves nothing off the critical path. All three are exactly why #1 (timing) must come first.

**Note on #3/#4 (render, quality-neutral targets):** the parity direction forbids cutting supersampling, but the per-region loop's *layout-fit search*, *redundant stroke raster*, and *full-page warp allocation* are quality-neutral overheads — the legitimate render levers. Gains are unmeasured (only the aggregate tqdm bar exists); instrument per-region raster-vs-warp to size them.

---

## 4. Measure-first list (the honest #1 prerequisite)

Add a monotonic timer around each stage entry and log `stage=X elapsed=Yms` alongside existing count/resolution lines. Because these stages are **deterministic given fixed input** (no sampling inside detection/mask/inpaint/render/merge), a single instrumented run — or an offline single-image dump — is a valid measurement; the non-determinism is only at OCR-VLM/LLM, which is why you must time per-stage, never A/B whole runs.

1. **Translation round-trip (highest priority — the biggest blind spot).** Wrap `custom_openai.py` `client.chat.completions.create` (≈L228) with `perf_counter`; log `elapsed`, split `prompt_tokens` vs `completion_tokens` (`response.usage`), and count retries. Also time `_run_text_translation` end-to-end incl. retries. This is the one large uninstrumented network wait on the critical path.
2. **Inpaint LaMa forward.** `torch.cuda.Event` start/stop around the model call (`inpainting_lama_mpe.py` ≈L106-107) AND `perf_counter` around the awaited `_run_inpainting` — so you separate GPU forward from the cv2 resize/pad/`.cpu()` glue. Log next to the existing resolution line. (You can *already* read whether pages hit the 2048 cap from the existing resolution logs — do that before touching anything.)
3. **Render sub-breakdown.** Inside the `[render]` per-region loop, split `put_text_*`/`_render_glyph_stroke` (raster+stroke) vs `cv2.warpPerspective` vs the layout-fit/`squeeze_width` search, to confirm the ss² raster is the sub-driver (code-read hypothesis) vs warp/layout.
4. **Detection.** `perf_counter` around `_infer`, and *separately* around `cv2.bilateralFilter` — this settles the competing "GPU forward vs CPU bilateral dominates" hypothesis in one run.
5. **OCR decode.** `torch.cuda.synchronize()` + `perf_counter` around the chunk loop; log per-page OCR time, chunk count, and **realized decode steps** (where `finished_hypos` breaks vs the 255 cap) and N lines/page.
6. **Textline merge.** `perf_counter` around `dispatch_textline_merge` (anchor by symbol, not line — `manga_translator.py` is modified in the working tree) + log `len(ctx.textlines)`; watch pages with n>100.
7. **Whole-request boundary.** Add an elapsed field to the Uvicorn request log so per-stage sums can be checked against a near-total.

**Go/no-go gate:** for any stage measured at < ~2% of page wall-time (likely detection, textline-merge, mask, probably OCR), **stop** — do not optimize it. Spend effort only where the timers show real share.

---

## 5. Do-not-do / traps (failed adversarial review)

**Quality-regressing — off the table without explicit user sign-off (violates the decided render-parity bar):**

- **Adaptive/size-gated supersampling (drop ss=4→2 on large glyphs).** Directly contradicts the decided flat-4× parity direction. Premise is also weak: stroke radius scales with font size, so large glyphs (SFX/titles) have thin, alias-prone outlines that 4× specifically smooths — it degrades quality *where readers notice most* for the least aggregate saving. Cannot be A/B'd on full runs (non-deterministic geometry).
- **Lower `detection_size` (2048→1536).** Worst risk/reward: reduces recall of small/thin glyphs (furigana, dense speech) and **SFX** — colliding head-on with the approved #168 SFX feature at its source. Missed detections cascade irreversibly (never OCR'd, never rendered). Payoff is a few hundred ms on an already-minor stage.
- **Lower `inpainting_size` (2048→1024).** Softer/blurrier backgrounds where the mask overshoots textured art. Also frequently a no-op: `_infer` only downscales when the page exceeds the cap, and many scanlated pages are already < 2048; on the patch path it runs on small crops where the knob rarely binds. Confirm from existing resolution logs before considering.
- **Reduce OCR beam width (k=5→3).** Touches OCR accuracy — a narrower beam changes decoded text on ambiguous glyphs, and wrong source text → wrong translation. Worse, it's self-contradictory: the other OCR options argue the loop is *launch-bound*, in which case shrinking beam tensors barely moves wall-clock (same number of sequential steps/launches). Highest risk, lowest confidence of gain.

**Wrong performance model / negligible / redundant (drop on technical merit):**

- **OCR "kill per-step host-device sync."** False premise: the `index_select` rebuild sits behind `if finished_batch_indices.numel()==0: continue`, so it runs ~N times total (on finishing steps), **not per step**. And capping `max_seq_length` 255→64 doesn't cut per-step attention (decoder already reads `[:step]`), only the one-time allocation — plus adds a >64-token truncation risk. Mechanism as described doesn't exist.
- **OCR raise `max_chunk_size`.** "2–3× fewer loops" is a loop-*count* claim, not wall-time: merged chunk's step-tail = the single longest line across all lines, and every line pads to the widest. Net win only if launch-overhead dominates (the unproven hypothesis). Real VRAM risk: `cached_activations` grows N·k and can OOM the 12 GB card against Flux/LaMa. Measure-first at best.
- **Textline spatial index / STRtree.** n is tens, not thousands — index build costs more than the naive loop below n~100. Correctness trap: merge radius is *per-pair* (scales with the larger box's font), so a global cell size can silently fragment a text block (wrong wrap / duplicated bubbles) — a parity regression.
- **Textline reuse `.polygon` (convex hull) in the predicate.** Semantic change: predicate uses raw 4-point `Polygon(pts)`; the cached `.polygon` is the convex hull, which for concave/skewed OCR quads gives a *smaller* distance and flips merge decisions. Silent parity change, not the claimed "none."
- **Detection FP16 autocast.** Optimizes the GPU forward, but the competing hypothesis is that the CPU bilateral dominates — may speed the wrong slice. At batch=1 the R34 forward is launch-bound; realistic saving ~10–40 ms against a 12 s render = noise. VRAM claim is wrong (peak is Flux/render, not detection). Measure-first, low priority.
- **Detection `getPerspectiveTransform` vs `findHomography+RANSAC`** *(this is actually a render-stage item)*: with exactly 4 correspondences RANSAC does no random subsampling (already deterministic), the two solvers can differ in last-ULP pixels (not byte-identical, which this study prizes), and `getPerspectiveTransform` *throws* on degenerate points where the current code returns `None` and skips → new crash surface. Zero measurable gain. Cleanup, not perf.
- **Inpaint "crop to mask bbox."** Largely redundant: the default patch path already inpaints per-region crops (`inpaint_context_pad` #249, `mask_tighten` #268). Manga bubbles are scattered top-to-bottom, so the *union* bbox usually spans most of the page; splitting into tiles is just the existing per-crop path (many small rfftn/irfftn = launch overhead, can be *slower*). At `ratio_gin/gout=0.75` the FFT global branch dominates, so narrowing context is a real quality risk, not a corner case.
- **Micro-batch multiple pages into one LLM call.** UX regression (no page returns until the whole batch decodes — kills progressive Reader display), saving is fixed-cost only (redundant with prefix caching), and `_assemble_prompts` re-splits at 4096 chars so large batches fan back out anyway. Cost/benefit inverted.

**Methodology traps (apply to everything):**

- **Never A/B two full translate runs to measure a change.** OCR-VLM + LLM sampling make region count/text/geometry non-deterministic; a "speedup" could be a different page's worth of regions. Use per-stage timers or an offline fixed-input single-image dump.
- **Don't trust size proxies as time.** Token counts and inpaint/detection resolutions tell you *work*, not *seconds*. No conclusion about translation or inpaint wall-clock is valid until Section 4 lands.
- **Anchor instrumentation by symbol, not line number** — `manga_translator.py` and several stage files are modified in the working tree, so cited line numbers may be stale.
