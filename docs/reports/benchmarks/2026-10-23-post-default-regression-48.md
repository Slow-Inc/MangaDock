# Post-default regression sweep 48: quality holds at 1.48/2 with every guard on

- **Date:** 2026-10-23 · 8 real pages, all guards at their current defaults (foreign-script + salvage, negation, runaway,
  filler, lost/rare, dropped_question, untranslated_word, content_loss, contract, series name memory, filter-after-strip).

## Results

| metric | value |
|---|---|
| pages | 8 (Mieruko, Kage, Boku, Otome, Maou, Horimiya, Dungeon, Osoraku) |
| gate | **0 violations** |
| glitch triggers | **1** (`content_loss` on an OCR-merged credit-ish line: `GODMOTHER OF FORTUNE TELLING AND EXORCISM` -> a shortened fortune line; a true positive by the ratio rule) |
| judge | **86 segments, mean 1.48/2**, single 0-score (`Horimiya p0 #2 wrong`) |
| series memory | no `series_context` in doctor runs -> no-op, as designed |

## Comparison

Full-corpus baseline: **1.44/2** (403 segments, batches 1.36-1.58); the previous post-default sweep was **1.48**. The
new defaults therefore hold the baseline with a much quieter guard profile than the defect-rich pages used earlier in
the loop (7 triggers on one 8-page sweep -> 1 trigger here).

All eight guards now sit at their evidence-based default, each with an escape-hatch env flag and a forced-injection or
unit proof; the opt-in list is unchanged (batch pipeline, preload, widen columns, segment retry, fit-below-floor,
concise bubbles, context pages).