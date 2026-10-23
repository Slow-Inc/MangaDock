# Fresh p1-page audit (8 pages): best judge mean yet, another live guard catch, disk-safe runs

- **Date:** 2026-10-23 · pages: Mushoku Tensei p1, Maou no Ore p1, Osoraku p1, Taida p1, Kage p1, Akuyaku p1,
  Iruma p0, Komi p1 (`--tag _fresh23`).

## Results

| metric | this set | previous fresh set (round 85) |
|---|---|---|
| judge segments | 67 | 53 |
| judge mean (raw) | **1.58/2** | 1.43/2 |
| perfect / minor / broken | 39 / 28 / **0** | 26 / 24 / 3 |
| gate violations | **0 on all 8** | 0 after the question-marker fix |

Judge flags are again dominated by its typo noise (it reports identical strings as misspelled). The only
meaning-level flag worth noting is a fragment: Komi p1 `IOO` (cut-off `100`) rendered as `ฉัน` — same fragment
class already recorded as a model limitation, not a guard candidate.

## Guard aggregate (rounds 21-23: 26 live pages with `MIT_LOG_GLITCH=1`)

| trigger | count | verdict |
|---|---|---|
| `spurious_filler` | 2 | true positives (Dungeon page); re-asked, filler removed |
| `foreign_script` | 2 | true positives (CJK leaks `接连`, `觊觎`); re-asked, shipped lines verified clean |
| false positives | **0** | — |

So the guards fire on roughly **1 in 6 pages** of live traffic, and every observed hit was a real defect. The
foreign-script guard in particular earned its keep twice in two rounds (the retry output was verified clean both
times).

## Disk hygiene

The render PNGs regenerate from the JSON and were the cause of the D: drive filling up (4.36 GB deleted last round).
Added `tools/doctor_page.py --no-png`: skips `.rendered.png`/`.doctor.png` while keeping the JSON report, gate, and
timings — verified on a live page (JSON only, gate clean). Sweeps should use it on disk-constrained machines.