# Full-corpus judge audit: 39/39 pages, 1.44/2 mean, 2.7 % broken (quality baseline)

- **Date:** 2026-10-23 · 5 audit batches over every real page in `MIT/result/{corpus,corpus2,corpus3}`.

## Coverage and scores

| batch | pages | segments | mean | 0/1/2 |
|---|---|---|---|---|
| audit82 | 6 | 71 | 1.37 | 2 / 41 / 28 |
| fresh22 | 8 | 53 | 1.43 | 3 / 24 / 26 |
| fresh23 | 8 | 67 | **1.58** | 0 / 28 / 39 |
| f24+g21 | 18 | 178 | 1.42 | 6 / 91 / 81 |
| f24b | 3 | 33 | 1.36 | 0 / 21 / 12 |
| Kaoru p1 (1 region, manual) | 1 | 1 | 2.00 | 0 / 0 / 1 |
| **total** | **39/39** | **403** | **1.44** | **11 / 205 / 187** |

Broken segments = **2.7 %**; the judge's raw score is depressed by its known typo noise (it repeatedly reports
identical strings as misspelled), so the meaning-level share of perfect output is higher than 46 %.

## Live guard catches during the same runs (26+ pages with `MIT_LOG_GLITCH=1`)

| trigger | count | outcome |
|---|---|---|
| `foreign_script` | 3 | all true positives (CJK leaks `接连`, `觊觎`, `甚至`); re-asked; shipped lines verified clean **twice**, the third line was still glitched on attempt 3 |
| `spurious_filler` | 2 | true positives (Dungeon p0); re-asked, filler removed |
| false positive found | 1 | `ข้าทนทานดี` (ทนทาน = tough) was flagged as filler — **fixed** by excluding `ทาน` in the pronoun+ทน pattern; regression test added |

## Limitation observed: exhausted-retry glitches still ship

On Tsuki p0 the line `ICANT EVEN GIVE YOU ANY POWER` went CJK leak -> CJK leak again -> filler (`ฉันทัน...`),
exhausting `_INVALID_REPEAT_COUNT = 2`; the third answer shipped even though the trigger fired again. The guards
remove most leaks (verified twice), but with the retry budget exhausted the last answer is accepted unchanged.
Candidate follow-ups (not shipped): one more retry for `foreign_script` only, or stripping leaked-script characters
as a final salvage — both need an A/B because they trade latency/blank-text risk for quality.

## Also recorded

- Cross-page name inconsistency outside the batch path (`TSUKUYOMI` on Tsuki p0/p1: `ทสึคุโยมิ` vs `สึกิโยมิ`) —
  the #980 glossary only runs in the opt-in batch pipeline; single-page production has no cross-page memory.
- `doctor_page.py --no-png` kept every run in this sweep to JSON-only (disk-safe).