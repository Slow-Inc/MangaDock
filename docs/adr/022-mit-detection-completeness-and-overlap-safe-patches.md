# ADR 022 — MIT detection-completeness nets + overlap-safe patch compositing

- **Status:** Accepted (2026-07-05)
- **Branch:** `landing/render-phase0` (PRD #535, issues #536/#537/#538)
- **Supersedes / extends:** [ADR 004](004-mit-patch-based-rendering-pipeline.md) (patch pipeline),
  [ADR 006](006-mit-bubble-aware-detection-grouping.md) (bubble-aware detection),
  [ADR 007](007-mit-render-parity-clean-layout-narrow-column-supersampling.md) (clean-layout render).

## Context

Two "master plans" had already shipped render fixes, yet a single wild page (Otome Game Sekai p10,
recovered from the Reader chapter cache `img-cache/_chapters/.../ds9.jpg`) still exhibited **eight
distinct defect classes** the user caught by eye: empty bubbles, tiny text, text-over-text, tiny
wide text in tall rectangular balloons, an untranslated caption box, an untranslated SFX, a Thai
word split mid-syllable, and a translated-but-not-erased "ME OFF!" ghost.

Root-cause tracing (per-annotation, live, with the enriched `/patches` telemetry + defect scorecard
built in #537) showed these were **not one bug** but a stack of independent failures at every stage
of the pipeline — detection, OCR-filtering, translation-parsing, layout, mask, and compositing. Three
of them were fixes that existed on `main` but had **never been ported to the perf stream**
(item-9 ss-rewrap floor, numbered_contract, longest_token_width).

The decisive user insight — *"the patch may not be covering the original text"* — pointed at the
compositing layer, which turned out to be the real "ME OFF!" ghost root.

## Decision

Adopt a **layered completeness + overlap-safety** posture in the MIT detection→render pipeline.
Every mechanism is pure-geometry / pure-cv2, unit-tested, and best-effort (any failure leaves the
prior behaviour unchanged).

### 1. Detection completeness — three nets, escalating generality
Detected text can be missing because a detector is blind to it. Rather than tune one detector, add
independent nets (all gated behind `det_bubble_seg`, appended as empty textlines that flow through
the existing `vlm_rescue` → translate → render path exactly like a rescued SFX):
- **Empty-balloon rescue** — an inked balloon (YOLO-detected) with no textline covering its **ink**
  (≥50% ink-coverage, measured on the balloon *interior* after a 10% border shrink to exclude the
  black outline) is missed text.
- **White caption-box detector** — square white caption boxes are *not* speech balloons, so the
  balloon YOLO never proposes them; bright, box-like connected components (fill ≥0.7 of their bbox)
  join the balloon pool. Also used to **grow** a tagged `bubble_box` up to the containing white box
  when the YOLO box stops short of the true caption (live: y1182→1247).
- **Ink-cluster net** — the last net under everything: sparse dark strokes on a light background
  with no covering region, gated by ink-density (4–45%) + background-lightness (median ≥190) to
  reject art.

### 2. Source-language filter must not drop Latin-script source on a langdetect misfire
`source_lang_only` used `langdetect`, which is non-deterministic and misfires on short/all-caps Latin
text ("STARTING WITH THE HEROINE…"→Maltese, "SiEg…"→Danish). **Pure-ASCII text cannot be a non-Latin
source**: when the requested source lang is Latin-script, keep ASCII regions deterministically.

### 3. Numbered-contract parsing is by index, not by position
The GPT numbered contract (`<|i|>text`) was split **positionally** (`re.split`), so one dropped index
shifted every following bubble's translation — a silent page-wide misalignment. Parse **by index**
(port `main`'s `numbered_contract`, exactly-N normalization), single-query no-prefix fallback kept.

### 4. Erase mask covers a region's own balloon; patch alpha covers only changed pixels
- The empty-bubble erase guard (#535/0b) may erase a region's **own** balloon interior, incl. leftover
  source strokes the detector's box missed — the translation re-renders over that balloon.
- **Overlap-safe patch alpha (the ghost root):** patch crops overlap; a patch composited as a full
  opaque rectangle repaints its crop's *original* pixels over a neighbour's already-erased work,
  resurrecting erased text. Patch alpha is now **only the pixels the patch actually changed** vs the
  pristine crop (diff > 8, dilated 3px against anti-alias seams), multiplied with the optional
  feather band. Overlapping patches **compose** instead of stomping each other.

### 5. Render routing additions (extends ADR 007)
- `bubble_fit_tall` — a tall rectangular balloon interior reuses the clean-layout font search (tall
  readable column, not a small wide strip).
- `sfx_display` gated to **free-floating** SFX only — a rescued SFX inside a balloon is dialogue.
- `dedup` extended to blank equal-translation balloon-quads (not just substring duplicates).
- `page_shape` threaded so clean-layout's wrap clamp is page-relative, not crop-relative.
- Metric `dst_box` stamped in page coords (was crop coords → false cross-group overlaps).

## Consequences

**Positive.** Otome p10 renders fully clean (every box/bubble carries its own translation, no ghost /
dupe / phantom / word-split); katakana SFX chains now localize (カチカチ→กึกกึก) — a new capability. The
metric gate + enriched payload catch and attribute regressions automatically (they caught the coord
bug themselves). Each net is small, independent, and reversible.

**Negative / risk.**
- The overlap-safe alpha (`changed_alpha`) touches **every** patch — needs a regression sweep on other
  pages (One-Punch p1/p2 EN+THA) before promotion; not yet run.
- `MIT_PATCH_FULLPAGE_INPAINT=1` (prod) uses the full-page path which bypasses the per-crop guard/erase;
  overlap-alpha still applies but must be verified on that path separately.
- The completeness nets are heuristic (thresholds tuned on one page across ~4 live iterations each);
  they may over/under-fire on very different art. Mitigated by ink/lightness gates + best-effort catch.
- `langdetect` ASCII carve-out assumes ASCII ⇒ Latin source; correct for the supported source langs.

**Follow-ups.** Regression sweep + scorecard gate before promotion; full-page-path verification;
2nd-manga (Gal Yome) coverage; converge the ~50-commit landing branch into perf/main (Phase 3).

## Validation
TDD throughout (RED→GREEN per fix); ~98-test MIT sweep green. Live per-round verification on the wild
page with committed before/after PNGs + scorecards in
`docs/reports/benchmarks/2026-07-04-defect-pages-before-after.md` (rounds 1→8, v1→v16).
