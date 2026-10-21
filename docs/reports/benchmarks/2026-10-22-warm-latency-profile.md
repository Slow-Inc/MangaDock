# Warm in-process latency profile — where the 11 s/page actually goes

- **Date:** 2026-10-22 · **Method:** `doctor_page.py` on 5 pages in ONE process (corpus 3, EN→THA, production patches path). Page 1 is cold (model load), pages 2–5 are warm; the table below is the warm average over 4 pages.
- **Why this file:** the doctor's per-run `timing_ms` is cold (fresh process per page), so it cannot rank stages for speed work. This is the warm baseline the speed half of the goal should be measured against.

| stage | warm avg | share |
|---|---|---|
| **OCR** (48px line model + SFX rescue calls) | **6019 ms** | **54 %** |
| textline_merge | 1836 ms | 16 % |
| translation (gateway) | 1627 ms | 15 % |
| detection | 712 ms | 6 % |
| inpainting | 316 ms | 3 % |
| mask_refinement | 240 ms | 2 % |
| rendering (layout + draw) | 212 ms | 2 % |
| **wall** | **11147 ms** | |

Per page (lines = detected textlines):

| page | lines | wall | detection | ocr | merge | translation | render |
|---|---|---|---|---|---|---|---|
| Boku p1 | 35 | 11259 | 561 | 5117 | 3200 | 1514 | 145 |
| Dungeon p0 | 22 | 6938 | 775 | 4161 | 342 | 1198 | 99 |
| Dungeon p1 | 23 | 8042 | 766 | 4588 | 818 | 1186 | 156 |
| Horimiya p0 | 72 | 18349 | 744 | 10211 | 2985 | 2610 | 447 |
| *(cold) Boku p0* | 37 | 21831 | 5895 | 7037 | 2375 | 1536 | 1966 |

## What this changes

- **Rendering is not the target** (2 %): the exhaustive font scan kept in round 5 (#761) is cheap next to OCR. Do not spend a round there.
- **OCR is 54 %**, and part of it is the vision SFX rescue: each served crop is a ~2.3 s gateway call inside the OCR stage (Horimiya p0 has `sfx=1`, Dungeon p1 `sfx=2`). Split before optimizing: measure OCR with `MIT_OCR_VLM_RESCUE=0` vs on.
- The OCR line model runs ~4–6 s for 22–72 textlines (~150 ms/line warm) — the next question is whether the crops are batched into GPU forwards or run one at a time; a batch that does not change the reads is the obvious lossless win, and #872's own note ("OCR chunk 64 rejected: slower, changes reads") says the chunk size was tuned before, so re-measure rather than assume.
- Cold-vs-warm gap is ~10 s of model load per process: any latency number taken from a one-page doctor run is meaningless for the goal.
