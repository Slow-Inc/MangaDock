# #626 render gate — reconciled == landing baseline (deterministic CPU A/B)

**Date:** 2026-07-10 · **Branch:** `integrate/render-reconcile` · **Issue:** #626

![reconciled vs landing vs diff = 0](./2026-07-10-626-render-recon-vs-landing.png)

## Result: BYTE-IDENTICAL to baseline ✅

Deterministic CPU dump-replay (same `MIT/_render_dump` = Gal Yome EN→TH, fixed inpaint + fixed
translations) rendered through reconciled vs landing code, identical knobs:

**reconciled render == landing baseline: 0 / 1,643,760 pixels differ (0.0000%, max diff 0).**

## Why (the pivot)

The FIRST attempt kept main's render spine (`_bubble_fit_layout`, reference_layout #178, KP #180) and
showed a **3.96% difference** — reconciled filled balloons larger than the landing baseline the dev
tuned. Per the dev's hard constraint **"คุณภาพต้องเหมือน baseline เท่านั้น" (quality must equal
baseline, full stop)**, the render-geometry subsystem was pivoted to **landing's exact code**:
`rendering/__init__.py`, `render_overlap.py`, `rendering/text_render.py`, `patch_geometry.py`,
`patch_renderer.py`, `text_layer.py`, `stages.py` + their tests + goldens regenerated from landing.

main's render campaign (reference_layout / Knuth-Plass / width-squeeze) is therefore **NOT in the
default output** — it is shelved (the `reference_layout` config field + `MIT_REFERENCE_LAYOUT` mapping
remain but are inert; `reference_layout.py` / `render_replay.py` / `sizing_trace.py` are orphaned
observability). The integration keeps main's **non-render** work: translators (+#623 thinking fix),
Backend/Frontend, config, CI-infra (lazy-import #359 / ADR 029).

## Validation

- Render A/B: **0.0000% diff** vs landing baseline (byte-identical).
- Characterization net: **159 passed, 0 failed** (landing's render test suite + main non-render +
  #623 thinking). Goldens regenerated from landing render code.
- Orchestrator `manga_translator.py` compiles; render+patch import cluster coherent.

## Still pending (needs GPU) — translation gate

The dump has FIXED translations, so translation quality isn't testable from it. Remaining:
#623 thinking-OFF vs thinking-ON A/B on a fresh translate, and confirming the detection/OCR/translate
text matches baseline quality — needs a GPU translate run (stop perf workers on :5003/:5004 first).
