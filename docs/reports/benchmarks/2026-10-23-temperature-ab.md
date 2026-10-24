# Temperature A/B: 0.5 vs 0.2 (pilot + full-corpus translation; judge running)

- **Date:** 2026-10-23 · paired runs on all 39 corpus pages (11 pilot + 28 rest), real gateway.

## Guard activity (the quality-relevant defect proxy)

| arm | pilot 11 pages | rest 28 pages | total 39 |
|---|---|---|---|
| temp 0.5 (current default) | 4 triggers | 6 triggers | **10** |
| temp 0.2 | 1 trigger | 5 triggers | **6** |

Lower temperature reduced natural guard hits by ~40 %, but the effect shrank on the rest of the corpus (the pilot
was optimistic).

## Judge (full corpus)

| arm | pages | segments | raw mean | zeros | strict-adjusted | noise flags |
|---|---|---|---|---|---|---|
| temp 0.5 | 38 | 376 | 1.41 | 13 (3.5 %) | **1.51** | 52 |
| temp 0.2 | 37 | 364 | **1.45** | 14 (3.8 %) | **1.58** | 62 |

Paired per-page: **0.2 wins 17, 0.5 wins 12, ties 8** — a five-page margin on 37 pages, i.e. exactly the loop's own
noise boundary (null calibration: page margins ≤5 are noise). The point estimates and the guard-hit reduction
(10 -> 6) lean 0.2, but nothing here clears the noise bar.

## Decision

**Keep the default at 0.5.** The full-corpus numbers lean 0.2 (raw +0.04, adjusted +0.07, guard hits 10 -> 6) but the
paired margin is within noise and there is no independent evidence on naturalness, so flipping the production default
would violate the loop's own A/B rule. The lever is now available as **opt-in** without code edits:
`MIT_TEMPERATURE=0.2` on the Backend -> `translator.temperature` -> `ConfigGPT.temperature` (absent -> translator
default 0.5, config byte-identical). Re-test with new pages/data before considering it as the default.