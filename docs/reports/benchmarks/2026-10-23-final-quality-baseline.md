# Final quality baseline (39-page config end state): **raw 1.44/2, noise-adjusted 1.55-1.68/2** (classifier-dependent)

- **Date:** 2026-10-23 · judge over the **final 39-page sweep outputs** (`final56`, the exact end-state defaults),
  real gateway, chunked judge; noise classified with `tools/audit_summary.py`.

## Numbers

| metric | value |
|---|---|
| pages judged | 38 (one page produced no scorable segments) |
| segments | **367** |
| raw judge mean | 1.44/2 |
| judge noise flags removed | **59 (16 %) strict / 98 (27 %) lenient** |
| **noise-adjusted mean** | **1.55/2 strict** (1.68 lenient) |
| adjusted distribution | **13 / 138 / 216** = broken **3.5 %** / partial **37.6 %** / perfect **58.9 %** (strict) |

This is the definitive quality number for the loop's end-state configuration: same corpus, same defaults as the
39-page deterministic sweep that recorded 9 guard saves and **0 leftovers**.

## Real remaining classes (from the adjusted real flags)

- **Clause omission** (`this piqued my curiosity` dropped while the rest rendered) — a content-loss variant the ratio
  guard cannot see when other clauses keep the length plausible; model ceiling.
- **Transliteration/word choice** (`เมี้ยว` vs `เหมียว` for NYA, `เพราะ` misused for 'that's why') — lexical taste.
- These match the earlier 480-segment profile; no corruption-class defects remain.

## Note on the missing page

One of the 39 payloads had no segment with both source and translation for the judge (all-filtered page); it is not a
failure — the page simply had nothing scorable.
## Render/layout metrics: clean on all 39 pages

Parsed the per-page render + composite telemetry from the same sweep:

| metric | total over 39 pages |
|---|---|
| render.root / inherited | 0 / 0 |
| render.spill / overlap | 0 / 0 |
| render.small_font / suppressed | 0 / 0 |
| composite.root / inherited / invisible | 0 / 0 / 0 |

**No page has a layout defect** (no oversized block leaving the patch, no overlapping text, no text below the font
floor, no invisible composite) — the render side of the end state is deterministic-clean, complementing the text
quality numbers above.

## Classifier note (updated)

The noise classifier now treats **any real typo pair** (left != right) as a real finding, which is conservative: the judge's Thai-tokenizer artefacts often pair near-identical strings, so some of those 37.6 % partial flags are still noise. The honest range is **raw 1.44 / strict-adjusted 1.55 / lenient-adjusted 1.68**, with the 58.9-70.6 % perfect range; the earlier single number (1.68) was the lenient cut.
