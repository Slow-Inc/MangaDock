# Regression sweep after the Otome defect batch (changed_alpha / page_shape / dedup)

`changed_alpha`, `page_shape` threading, and the equal-translation dedup touch the patch path
pipeline-wide — this sweep confirms they didn't regress the two already-clean pages.

Worker: `landing/render-phase0` (all fixes through `da55ed7b`). `/patches`, prod-faithful config.

| run | regions | empty | size | overlap | sibling-Δ | vs baseline (2026-07-04) |
|---|---|---|---|---|---|---|
| p1 ENG | 9 | **0** | 2* | **0** | 0 | 8→9 regions (SILENCE + SQUELCH both rescued now); empty/overlap hold |
| p1 THA | 9 | **0** | 0 | **0** | 0 | asym 1→**0** (improved) |
| p2 ENG | 9 | **0** | 2* | **0** | 0 | 8→9 regions; empty/overlap hold |
| p2 THA | 9 | **0** | 0 | **0** | 1† | unchanged |

- **empty=0 and overlap=0 hold on every run** — the critical classes did not regress.
- *size=2 on ENG = the intentional `sfx_display` shrink (SQUELCH + SILENCE kept on one line) — the metric
  flags a shrink; both render correctly (verified by eye). Harness refinement: exempt `branch=sfx_display`.
- †p2 THA asym=1 = the อึม/อ่า sibling pair, genuinely different sizes in the source too.
- **Net: no regression; a small improvement (one more SFX rescued per page).** Overlap-safe alpha is clear
  to promote for the per-crop path. (Full-page-inpaint path verified separately.)

Images: `2026-07-05-regsweep-{p1,p2}-{eng,tha}.jpg`.
