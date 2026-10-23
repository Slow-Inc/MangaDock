# Master-plan critical items re-checked at HEAD: the readable-floor defect no longer reproduces

- **Date:** 2026-10-23 · telemetry from the 39-page final sweep (`font_px` / `font_src_px` per region).

## Readable-floor (plan defect #1/#2, was 5/10 pages with 3-4 px unreadable fallbacks)

| check | result |
|---|---|
| regions with font telemetry | 368 |
| **minimum final font** | **15 px** (three regions) |
| regions below 14 px | **0** |
| render telemetry `small_font` | 0 across all 39 pages |

The smallest cases are 15-16 px on 1100-1600 px pages with 11-13 px source lettering — slightly scaled *up*, legible.
The old defect (font floor derived from a small crop → ~3-4 px) does not reproduce with the current clean-layout /
floor logic; this plan item is effectively resolved at HEAD (like #899).

## Other carried-over translation items (status from this loop)

| plan item | status |
|---|---|
| cross-page rolling context dead in prod patch path (#3) | **partially addressed**: series name memory gives name consistency; full `prev_context` still opt-in for the batch pipeline because the single-page path resets per request by design (#159). Honorific/pronoun drift remains open only on that path. |
| `reference_layout` promotion to default | still pending corpus metric + Knuth-Plass wiring (render campaign, outside this translation loop) |
| real vertical layout / AnimeText SFX default | still opt-in (render/detection campaigns) |
| deterministic quality gate | **delivered** (`tools/quality_gate.py` + dashboard), covering every class this loop found |
| translation accuracy classes | garble/leak/filler/lost/negation/question/untranslated/omission-out-of-retry now have guards or deterministic normalisation; remaining is model-ceiling sense/nuance (documented) |