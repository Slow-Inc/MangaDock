# Defect-resolution verification — reference_layout (for the project report)

**Rule applied:** a defect documented in an md isn't "done" until a benchmark ties back to THAT defect
and proves the symptom is gone (feedback-benchmark-confirms-md-defect-fixed).

## Method
- **Deterministic** replay (`render_replay.replay_clean_layout`) over the committed 4-fixture corpus
  (One-Punch EN→target + Gal Yome ds20/ds4/ds12 EN→TH), reference_layout ON vs OFF — no translator
  non-determinism. Metrics: `overflow_vs_det_w` (oversize/spill), `readability_ratio` (over-shrink),
  fill-region font size (under-fill).
- **Live** patch-path render (`/translate/with-form/patches`, main code) composited onto the originals — visual confirmation (image below).

## Result — per documented defect
| defect (md entry) | metric | reference OFF (prod default) | reference ON | status |
|---|---|---|---|---|
| narration-oversize, One-Punch (master plan §7f) | worst spill vs det box | **3.00×** (oversize) | **1.30×** (≤1.35 tol) | ✅ resolved (ON) |
| dialogue under-fill, Thai (item-2 / §7e) | fill-region font px | — | 69/28/50 · 30/38/55 · 36/42/… (fills) | ✅ no under-fill |
| narration over-shrink (§7g regression guard) | readability vs flat | — | ≥ 0.68 (≥0.6 floor) | ✅ not too small |

## Assessment
- **One-Punch narration-oversize: verified resolved** (ON) — deterministically (3.0×→1.3×) and visually
  (oversized/spilling → contained narrow column near the target). Residual: ON narration is ~0.68× the
  flat design size — slightly smaller than the target's mid column (within tolerance, not a defect).

### ⚠️ Correction (user-caught 2026-07-03) — Thai fill is NOT cleanly resolved
Visual review of the ON render caught two real defects the deterministic metric MISSED:
1. **Over-fill spill:** the oval bubble "มีอยู่หนึ่งอันนะ" fills at a large font but the rectangular text
   block **spills past the oval's curved edge** — the fill is bounded by the interior *bounding box*, not
   the true bubble shape.
2. **Text-loss:** the tall-narrow "plastic bag" bubble renders its Thai text tiny / mostly missing.

**Harness blind spot (root of the miss):** `overflow_vs_det_w` measures spill vs the **detection box**, not
vs the **actual bubble polygon** — so a block that fits the detection box yet overflows the oval reads as
"fill = good". The metric must be extended to measure the rendered block against the bubble mask/shape.

**⇒ Honest status:** narration-oversize resolved; **Thai fill path has residual over-fill (oval spill) +
a text-loss case → NOT done.** These are new defect items, and `reference_layout` is **not ready to
promote** until they + the metric blind spot are fixed.

### Limitation (production)
`reference_layout` is **flag OFF by default** → on the production default path the One-Punch oversize is
still present (3.0×, left column). The fix is verified for narration but the Thai residuals above mean the
promote-to-default step is gated on more than just the earlier threshold de-risk.

![defect-resolution verification: One-Punch OFF/ON/target + Thai orig/ON](./2026-07-03-defect-verification.png)
