# ADR 028 — reference_layout render engine (opt-in) + deterministic render-replay harness

- **Status:** Accepted (2026-07-02)
- **Issues:** #178 (render-parity PRD), #462 (harness PRD), #430/#175 (bubble/clean-layout sizing).
- **Area:** MIT render — `rendering/__init__.py`, `reference_layout.py`, `render_replay.py`; `config.py`
  (`render.reference_layout`, `detector.det_bubble_synth`); `test/fixtures/*-layout.json`.
- **Builds on:** ADR 023 (bubble-area-fit), ADR 024 (width-squeeze), ADR 025 (clean-layout page-scale).

## Context

Editing the shared MIT render path kept regressing already-good targets: a fix for one page (Thai
under-fill, One-Punch oversize) silently broke another, and the non-deterministic translator (OCR-VLM +
LLM sampling → different text/geometry per run) made worker-based A/B testing unreliable. A worse failure:
much of the campaign had been benchmarked through `/translate/with-form/image`, which **never tags speech
bubbles** (`_tag_regions_with_bubbles` runs only in `translate_patches`) — so every region read as
`has_bubble=False` and produced artefact "defects" that don't exist on the production `patches` path.

## Decision

1. **Deterministic render-replay harness (#462).** `render_replay.py` serializes the sizing-relevant
   region state once (`MIT_DUMP_REGIONS` hook in `translate_patches`) into a JSON fixture, then replays
   ONLY the font-sizing dispatch offline — no ML, no worker. Layout decisions become reproducible and
   diffable. A parameterized **two-sided safety-envelope** test asserts, over the whole fixture corpus,
   that every clean-layout region stays in-box: not spilling past its detection width (≤1.35×), not
   over-shrunk below the flat design size (≥0.6×), and fill regions actually fill (≥0.9×).

2. **`reference_layout` engine, opt-in behind `render.reference_layout` (default OFF → byte-identical).**
   For clean-layout regions it resolves one **layout intent** (`_reference_layout_intent`) — box, anchor,
   fill?, cap — from a single discriminator: a demoted-bubble region FILLS its balloon only when the
   distance-transform interior isn't much wider than the text (`interior_w/det_w ≤ 1.4`), else it renders
   as a narrow column (flat cap, detection-width wrap, generous vertical tolerance so it wraps to more
   lines rather than shrinking). Fitting uses `fit_to_box` — binary search **plus a bounded upward
   re-scan** to defeat word-wrap non-monotonicity (a larger font can fit a column that a middle font
   overflows; plain binary search returned the tiny branch).

3. **Benchmark rule:** MIT render is benchmarked through `/translate/with-form/patches` (tags bubbles),
   never `/translate/with-form/image`.

## Consequences

- **Positive:** the user-flagged narration-oversize (One-Punch top blocks 32–44px spilling ~2.3×) renders
  as readable narrow columns (~flat), while Thai dialogue still fills its bubbles (deterministic + live
  verified). Any render-knob effect is now measured deterministically; regressions in either direction are
  caught by the envelope guard, not by eyeballing a non-deterministic worker render.
- **Validated:** discriminator ratio across 17 bubble regions on 4 fixtures — Thai (fill) 1.07–1.20,
  One-Punch (narrow) 1.61–3.43, clean separation (~0.2 margin each side of 1.4). Benchmark reports:
  `docs/reports/benchmarks/2026-07-02-*` (narration-readable-narrow, demoted-bubble-discriminator,
  patch-path-methodology, production-defect-inventory).
- **Scope/limits:** `reference_layout` stays **OFF by default** — production is unchanged (byte-identical;
  golden pins pass). Promotion to default is a separate call, gated on a larger corpus + a multi-run
  path-flip check (the discriminator's stability under non-deterministic measurement is the main risk).
  The corpus envelope test is `slow`-marked (calc_horizontal-heavy). The production render itself is in
  good shape on the audited pages; the remaining manga-translation defects (LLM garble, untranslated SFX,
  romaji names) are translation/detection domain — out of this render decision.
- **Reversibility:** drop the flag / the harness with zero effect on the default path.
