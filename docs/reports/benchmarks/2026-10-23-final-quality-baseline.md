# Final quality baseline (39-page config end state): noise-adjusted **1.68/2**, 71 % perfect, 3.0 % broken

- **Date:** 2026-10-23 · judge over the **final 39-page sweep outputs** (`final56`, the exact end-state defaults),
  real gateway, chunked judge; noise classified with `tools/audit_summary.py`.

## Numbers

| metric | value |
|---|---|
| pages judged | 38 (one page produced no scorable segments) |
| segments | **367** |
| raw judge mean | 1.44/2 |
| judge noise flags removed | **98 (27 %)** |
| **noise-adjusted mean** | **1.68/2** |
| adjusted distribution | **11 / 97 / 259** = broken **3.0 %** / partial **26.4 %** / perfect **70.6 %** |

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