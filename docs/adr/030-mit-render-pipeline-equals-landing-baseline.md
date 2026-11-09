# ADR 030 — MIT render pipeline = landing baseline (main render campaign shelved)

- **Status:** Accepted (2026-07-11) — dev hard constraint
- **Builds on / affects:** #626 branch reconciliation (`docs/RECONCILIATION-PLAN.md`); relates to ADR 023 (bubble-area-fit), ADR 024 (width-squeeze), ADR 025 (clean-layout page-scale), ADR 028 (reference-layout + replay). **Those main-render-campaign ADRs remain valid as designs but are NOT in the default render output** after this decision.
- **Issues:** #626 (integration), #630 (dead-code removal follow-up).

## Context

The reconciliation had to converge three diverged branches (`main`, `landing/render-phase0`, `perf`) into one trunk. `main` and `landing` each carried a render campaign:
- **main** = layout/fit axis: `reference_layout` (#178), Knuth–Plass (#180), width-squeeze (#183), `_bubble_fit_layout` height-fill + monotonic re-open, sizing-trace/replay (#462).
- **landing** = the dev-tuned, user-confirmed "best" render (the baseline locked at `bench/render-quality-baseline` + `docs/images/render-quality/after-onepunch-eng.png`).

The initial #626 merge kept **main's render spine** and grafted landing's additions (per the original plan §2 Phase C). A deterministic dump-replay A/B (Gal Yome EN→TH, fixed inpaint + translation) showed the reconciled render filled dialogue balloons **3.96% larger** than the landing baseline — main's `_bubble_fit_layout` grows the font to fill the balloon height more aggressively than landing's fit. This is a *code* difference, not a knob (both sides ran identical render knobs in the A/B).

The dev then set a hard constraint: **"คุณภาพต้องเหมือน baseline เท่านั้น"** — the final render must EQUAL the landing baseline, not merely "not regress". Baseline (landing) is the authority for all render/translation quality.

## Decision

**The render-geometry subsystem = landing's EXACT code.** On `integrate/render-reconcile`, the following files were reset to `origin/landing/render-phase0` verbatim (verified byte-identical, `git diff` empty): `rendering/__init__.py`, `render_overlap.py`, `rendering/text_render.py`, `patch_geometry.py`, `patch_renderer.py`, `text_layer.py`, `stages.py`, plus their tests and regenerated goldens.

**main's render campaign is shelved** — `reference_layout` (#178), Knuth–Plass (#180), width-squeeze (#183) are NOT in the default output. main's `reference_layout.py` / `render_replay.py` / `sizing_trace.py` + their orphaned tests, the `MIT_DUMP_REGIONS` wiring, `config.RenderConfig.reference_layout`, and the `MIT_REFERENCE_LAYOUT` mapping were **deleted** in `a8b64f69` (#630, 2026-07-11) — recoverable via `archive/mit-180-kp-425` / `archive/mit-183-squeeze-424` / PR #423.

**main's NON-render work is kept:** translators (+ #623 thinking control), Backend/Frontend, config, CI-infra (lazy-import #359 / ADR 029), `textline_merge` `is_sfx` provenance. The integration is therefore **landing's MIT render + main's app/infra**.

## Scope of the "== baseline" claim (scrutinize 2026-07-11)

**"Render == baseline" is exact for the RENDER STAGE, given identical input regions.** The 7 render
files are byte-identical to landing, so for ANY given set of `TextBlock` regions the rendered pixels
equal landing's. The deterministic A/B proved this by replaying a FIXED region dump through both
render codes (0.0000% diff). **It does NOT prove the full-pipeline page output equals baseline**, because
the UPSTREAM stages (detection / OCR / SFX-rescue / region-filter — `manga_translator.py`,
`detection_postproc.py`, `ocr_vlm.py`, `textline_merge`) are **main's, not landing's** (they carry
main's #278 provenance, #623, #359). Different upstream can produce different regions (bubble boxes,
rescued SFX, OCR text) → a real translate MAY differ from the landing baseline page even with identical
render code. This is by design (keep main's detection/translation improvements), and is the exact gap
the end-to-end translate verify closes (pending a stable LLM gateway). **The dev must decide whether
"baseline for ALL quality" also requires landing's upstream, or whether main's (improved) upstream is
acceptable.** Consequence of the pivot on SFX: landing render treats a region as display-SFX only via
`sfx_rescued` (VLM-rescued), not `is_sfx`; a det_sfx region that isn't rescued lays out as normal text —
this is landing's baseline behavior (correct for the constraint), a change from main's `display_sfx`.

## Consequences

- **Render stage == baseline for ALL inputs**, proven at the code level (identical files), not just a sampled page. Deterministic A/B: 0.0000% pixel diff. Characterization net: 159 green (landing's render suite, goldens regenerated from landing code).
- **Translation quality gate:** #623 thinking-off A/B == baseline quality (no regression); #623 stays configurable, default OFF (dense-page safe). Caveat: the 9arm LLM gateway is intermittently flaky (empty content on complex prompts, both thinking modes — infra, not this decision).
- The main render R&D (#178/#180/#183/#462) is preserved as archive tags (`archive/mit-180-kp-425`, `archive/mit-183-squeeze-424`) + open PR #423 (#182 vertical), so it can be revisited as opt-in later without re-doing the work.
- Landmine #1 fixed as a side effect: `is_sfx` is now populated (both attrs from one provenance value), and landing's render natively sets the `/patches` `render_branch` telemetry (partially mooting #628).

## Reversibility

High. The shelved campaign is fully preserved (tags + PR #423). Re-introducing it as an opt-in flag path is a forward change; the default (render == landing) is the baseline the dev confirmed. Rolling back the whole integration = discard `integrate/render-reconcile`.
