# Temperature A/B: 0.5 vs 0.2 (pilot + full-corpus translation; judge running)

- **Date:** 2026-10-23 · paired runs on all 39 corpus pages (11 pilot + 28 rest), real gateway.

## Guard activity (the quality-relevant defect proxy)

| arm | pilot 11 pages | rest 28 pages | total 39 |
|---|---|---|---|
| temp 0.5 (current default) | 4 triggers | 6 triggers | **10** |
| temp 0.2 | 1 trigger | 5 triggers | **6** |

Lower temperature reduced natural guard hits by ~40 %, but the effect shrank on the rest of the corpus (the pilot
was optimistic).

## Judge (pilot only so far)

| arm | segments | raw mean | zeros |
|---|---|---|---|
| temp 0.5 | 118 | 1.52 | 6 |
| temp 0.2 | 118 | **1.62** | **4** |

Segment-level pilot favours 0.2, but 11 pages is below the loop's own ≥40-page A/B rule (null calibration: a ≤5-page
margin is noise). The judge for the remaining 28 pages (both arms) is running; the default decision waits for the
paired full-corpus numbers.

## Why this matters

Temperature is the last config lever with a plausible quality effect (fewer glitch retries). If the full-corpus judge
confirms equal-or-better quality at 0.2, it becomes a default candidate; if the effect disappears, 0.5 stays and the
pilot is recorded as noise.