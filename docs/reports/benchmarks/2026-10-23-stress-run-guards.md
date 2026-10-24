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
## Retry depth in the stress run

Parsed the trigger log per source line: **15 unique triggered lines**, only **one** line (`NYA`) tripped twice, none
tripped three times — so no segment exhausted the retry budget in this bad batch. The twice-retried line shipped as the
correct Thai cat sound (`เมี้ยว`), and the other short interjections came out clean (`AH` -> `อ๊ะ`/`อ้อ`, `EH?` -> `เอ๊ะ?`).

This validates the current `_INVALID_REPEAT_COUNT = 2` against natural model variance: two re-asks sufficed even when
the model answered in Chinese. If a future run shows three triggers on the same line (budget exhausted), that is the
signal to consider a higher budget or a blank-instead-of-garbage fallback.
## Quality after the bad batch (judge on the 7 affected pages)

Judged the seven pages that had any guard trigger and compared with their scores from the earlier final sweep:

| page | f106 (n, mean) | f56 (n, mean) |
|---|---|---|
| Kumo p1 | 3, 1.67 | 3, 1.00 |
| Mushoku p0 | 5, 1.60 | 5, 1.60 |
| Otome p1 | 5, 0.80 | 5, 0.80 |
| Akuyaku p0 | 11, 1.18 | 11, 1.27 |
| Anta p1 | 10, 1.70 | 10, 1.50 |
| Boku p1 | 11, 1.64 | 11, 2.00 |
| Dungeon p1 | 8, 1.50 | 8, 1.75 |
| **weighted** | **1.453** | **1.509** |

The **-0.057 delta is inside the loop's judge-noise band** (differences below ~0.1 on non-paired samples are not
distinguishable), so the bad batch did not degrade final quality after the guards. One zero-score segment:

- Otome p1: source OCR read `DEEEND` (= DEFEND) and the Thai shipped `ทำลาย` (destroy) — an **opposite-meaning error
  caused by the OCR garble**, not by a guard. The translation is fluent, so no deterministic predicate can see it; the
  judge's added 'typo' notes for that segment are the known judge noise (code-point check shows correct marks).

This class (OCR garble → plausible-but-wrong translation) is recorded as a future detection/OCR item, not a
translation-guard one.
## Deterministic OCR-noise repair: measured, not worth it

The one real error of the run (`DEEEND` read as `DEEEND` -> translated as destroy) suggested a "fix OCR-noise words
in the source" guard. Before building anything, mined the final corpus for **digit-in-word OCR noise** (the usual
`60NNA`/`Y0U` shape): only **7 occurrences in 368 regions**, and half are legitimate (`3RD`, `Part1`, `ZER0` as a
name), so a look-alike substitution would add risk for at most 3-4 tokens. The `DEEEND` case is a letter/letter
misread (`F` -> `E`), which no digit map would catch anyway.

**Decision:** no deterministic source-repair guard. The class (OCR garble -> fluent but wrong translation) needs an
OCR-confidence signal or a detection/OCR campaign, not a translation predicate; recorded as such.