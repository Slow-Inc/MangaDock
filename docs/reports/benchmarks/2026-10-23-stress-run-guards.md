# Stress run (39 pages): the model emitted whole Chinese lines — the guards still left zero defects

- **Date:** 2026-10-23 · full-corpus sweep with the latest code (`_final106`), real gateway, `MIT_LOG_GLITCH=1`.

## What happened

This run hit a visibly worse model batch than the earlier final sweep: **16 guard triggers over 39 pages** (vs 9
before), including eleven `foreign_script` hits where whole lines came back **in Chinese**
(`自从转生成为伊莉米拉...`, `喵`, `啊`, `但我就是...`) plus seven content-loss/question/filler hits.

## Outcome

| metric | result |
|---|---|
| pages | 39 |
| guard triggers | **16** (foreign_script 11, content_loss 4, dropped_question 2, spurious_filler 1) |
| leftovers after the retry loop (foreign script / content loss / typo tokens) | **0 / 0 / 0** |
| gate violations | 1 (`inconsistent_name`, expected in doctor runs without `series_context`) |

Even with a bad model batch, the retry loop + leaked-script salvage removed every Chinese line before the page was
written; the gate confirms no foreign-script region remained. This is the strongest natural-traffic evidence so far
that the guard set absorbs model variance.

## Note

The bad batch is an external model/gateway variance, not a code regression (no prompt/config change was deployed
between the runs). It strengthens the case for the guards and for the single-retry budget being sufficient — but also
shows why the exhausted-retry salvage must keep all script ranges (round 164/165 work).