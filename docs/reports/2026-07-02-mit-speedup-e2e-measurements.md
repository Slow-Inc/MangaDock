# MIT Speed Study — Real E2E Per-Stage Measurements (2026-07-02)

> Follow-up to [`2026-07-02-mit-speedup-study.md`](./2026-07-02-mit-speedup-study.md), whose #1 recommendation was "add per-stage wall-clock timers, then measure — the logs alone can't tell where time goes." This is that measurement.

## What was done

1. **Instrumented** the pipeline at the driver seam: a `@_timed_stage(name)` decorator on each `MangaTranslator._run_*` method (`manga_translator.py`) logs `[timing] stage=X elapsed_ms=Y`. Logging-only, zero logic change, byte-identical outputs. (This is study option #1 — trivial/low-risk. Still uncommitted in the working tree.)
2. **Restarted** MIT on the venv (cu121 GPU, RTX 4070 SUPER — confirmed `torch 2.5.1+cu121`, `cuda.is_available()=True`), cleared the 3-layer patch cache with services down (11 L3 + 35 PNGs), relaunched backend.
3. **Ran real E2E through the web** (`https://hayateotsu.space/`, cloudflared tunnel — never localhost) via Playwright: opened *Otome Game Sekai wa Mob ni Kibishii Sekai desu* ch.1, translated **page 1** (credits page, cold first-run) and **page 2** (dense story page, warm) EN→TH. Verified both rendered on screen (original↔translated screenshots committed).

## Raw per-stage numbers (`elapsed_ms`)

| Stage | Page 1 (cold, 14 regions→1 group) | Page 2 (warm, 9 regions→2 groups) | Reliable? |
|---|---|---|---|
| detection | 4415 | **1209** | ✅ clean — cold-start confirmed |
| ocr | 2150 | 1965 | ✅ clean |
| textline_merge | 677 | **10163** | ✅ real — O(n²) blowup on dense page |
| translation (LLM) | 4338 | 2802 | ✅ clean — network RTT |
| mask_refinement | 635 | 878 | ✅ clean — minor |
| inpainting | 296 | 294 | ✅ clean — **minor & stable** |
| rendering | 27117 | 61535 + 13432 (2 groups) | ⚠️ inflated — see caveat |
| render tqdm (glyph raster only) | 14/14 @1.15 it/s ≈ 12s | 6/6 ≈5s + 3/3 ≈2s | ✅ clean sub-signal |

## Confirmed findings (reliable signals)

1. **Render is the dominant stage, by a wide margin** — on both pages it is the single largest wall-clock contributor (≈27 s page 1; even larger page 2). Confirms the study's headline.
2. **The render tqdm bar massively understates render.** Page 1 in isolation (single translate, single group, no concurrency): render **stage = 27 s** but the tqdm glyph-raster loop is only **~12 s**. The other ~15 s is render work *outside the progress bar* — the 4× supersampling composite (render onto a 4×-scale canvas → warp → downscale a ~16×-pixel buffer). **This hidden supersample cost is the real render bottleneck, and the earlier log-only analysis could not see it** (it trusted the tqdm bar). New insight the instrumentation unlocked.
3. **`textline_merge` O(n²) is a real blowup on dense pages** — 0.7 s (sparse credits page) → **10.2 s** (dense story page with many SFX/textlines pre-merge). Exactly the study's hypothesis (`n` large → shapely all-pairs dominates). Not negligible on SFX-dense pages.
4. **Detection has a real cold-start** — 4.4 s first call (cudnn init/autotune on first GPU forward) → **1.2 s warm**. Steady-state detection is minor, as hypothesized; the first-page tax is real.
5. **Inpainting is minor and stable (~0.3 s)** — one full-page LaMa forward, reused across patch groups. The study's "inpaint is smaller than render/translation" hypothesis is **confirmed**; the earlier fear it might be significant is put to rest.
6. **Translation (external LLM) is moderate: 2.8–4.3 s** — first real wall-clock for the study's biggest blind spot. A real network round-trip, meaningful but far below render.

## Caveat — instrumentation v1 limitation (do not over-read the render seconds)

The decorator measures **wall-clock around an `async` coroutine**, which conflates *compute* with *suspension/contention*:

- **Multi-group pages emit one `rendering` timing per group** (page 2: 61.5 s **and** 13.4 s). Do **not** sum them — if the group renders overlap on the event loop, each wall-clock includes the other's waiting. Treat multi-group render numbers as loose upper bounds.
- The async wrapper cannot separate GPU/CPU compute from time the coroutine spent suspended while the loop serviced other work (health/ready polls, PNG encode, the second group).

**What to trust:** the *sequential single-group* page (page 1) numbers are clean wall-clock; the **tqdm render rate (~1.1 it/s ≈ 0.9 s/patch)** is a clean render sub-signal; detection/ocr/translation/inpaint/mask are clean (single sequential awaits).

## Recommended instrumentation v2 (next, for clean render attribution)

To pin the render bottleneck precisely (compute vs the supersample composite), refine timers to measure the **synchronous inner work**, not the async wrapper:
- `perf_counter` **inside** `dispatch_rendering` around: (a) the per-region glyph raster loop (the tqdm part), (b) the 4×→1× supersample downscale/composite, (c) the warp. This splits render's ~2× hidden cost.
- `torch.cuda.Event` around the inpaint and detection GPU forwards (separate GPU compute from cv2 glue).
- For multi-group pages, log group index so per-group render times are unambiguous.

## Bottom line

The instrumentation did its job: we now have **real per-stage numbers from a live web translate**, confirming render as the dominant cost. `textline_merge` O(n²) is a genuine secondary spike on dense pages. Inpaint/detection(warm)/mask are minor.

---

# Update — render phase split (v2 timers, same day)

Added two `perf_counter` timers **inside** `rendering.dispatch()` (both blocks are pure synchronous CPU — no `await` — so the timing is clean, not async-contaminated):
- `[timing-render] phase=layout_fit` — `resize_regions_to_font_size()` (per-region font-size fit + width-squeeze + clean-layout + O(n²) territory), runs **before** the draw loop.
- `[timing-render] phase=raster_loop` — the `[render]` tqdm loop (glyph raster **including** the 4× supersample downscale, which happens per-region inside `render()`).

Re-measured via web E2E (Otome ch.1 pages 3–4, fresh/uncached):

| render stage total | layout_fit | raster_loop | regions |
|---|---|---|---|
| 2696 ms | **1727** | 950 | 1 |
| 12699 ms | **11842** | 856 | 1 |
| 14996 ms | **13974** | 1020 | 1 |

**Decisive result — the earlier "render / supersampling" hypothesis is WRONG.** The bottleneck is **`resize_regions_to_font_size` (layout_fit)**, which explodes to **12–14 seconds for a *single region*** on some pages. The actual glyph raster + 4× supersample (`raster_loop`) is **~1 s** — cheap. And `layout_fit + raster_loop ≈ stage total` to within ~20 ms, so:
- **It is NOT an async/measurement artifact** — the v1 async-wrapper wall-clock was accurate; it just couldn't attribute.
- **It is NOT the 4× supersampling** — that's inside the cheap raster loop.
- **It is NOT the glyph draw.**
- **It IS the per-region font-fit search** (`fit_font_size` binary search + `squeeze_width` + `_bubble_fit_layout` / `_clean_layout_dst`). One hard-to-fit region alone can cost 12–14 s. The 60 s pages were simply several such regions summed across groups.

Output renders **correctly** on these pages (bubbles translate and place fine) — so layout_fit is *slow, not broken*: the fit/squeeze search does a large amount of work (repeated text measurement) to converge on a reasonable layout.

**This is exactly why measure-first mattered.** The prior study, working from the tqdm bar (the only signal in the logs), pinned the cost on render/supersampling. The truth — invisible to both the tqdm bar and log-only analysis — is the layout-fit search that runs *before* the bar.

## Next (this is where TDD applies)

Optimizing `resize_regions_to_font_size` / `fit_font_size` / `squeeze_width` is a real behavior-preserving change: **write a characterization test first** at the render seam that locks the current per-region `font_size` + `dst_points` output byte-identical for a set of representative regions, then optimize under green. Likely levers to investigate: memoize/scale text measurement, cap or coarsen the binary-search iterations, or short-circuit the width-squeeze when the box is already satisfied — each validated against the characterization test so render parity is provably unchanged.

