# textline_merge investigation (#872 hypothesis): panel detection is a single small call, not the spike source

- **Date:** 2026-10-23 · static trace + direct timing.

## Trace

- `manga_translator/utils/sort.py` calls `get_panels_from_array` (Kumiko) in two places: `sort_regions` (production) and
  `visualize_textblocks` (debug only).
- In production `sort_regions` is called **once per page** (`manga_translator.py:863`); the recursion inside it passes
  `img=None`, so panel detection does not repeat.

## Timing (Kumiko on real pages, CPU)

| page | panels | kumiko ms |
|---|---|---|
| Kage p0 | 2 | 163 |
| Kage p1 | 2 | 568 |
| Mieruko p0 | 2 | 119 |

Kumiko is content-dependent (up to ~0.57 s) but **cannot explain the 8.8 s `textline_merge` spikes** recorded in the
39-page sweep: the spike moved between pages/runs and the same page normally costs 0.3-0.4 s. Together with the earlier
triage (models not reaped, no size correlation), this closes the "panel detection I/O" hypothesis — the spikes are
transient host/GPU contention, not a duplicated detection or a slow geometry path.

## No change

There is no lossless code win here without changing reading order (downscaling Kumiko input) or skipping panel sorting
on low-text pages — both change ordering quality, so neither ships.