# Panel detection downscale — measured, not worth it (rejected)

- **Date:** 2026-10-22 · **Stage:** `textline_merge` reading order (`Kumiko` panel detection, `utils/panel`).
- **Idea:** detect panels on a downscaled copy of the page and scale boxes back; the sorter only assigns each
  region to a panel and sorts by panel index.

## Measurement (39 pages, CPU only)

| | mean panel time | reading-order mismatches vs full res |
|---|---|---|
| full resolution | **406 ms** | — |
| max_side 1200 | 320 ms (−21 %) | **1 / 39** |
| max_side 1000 | 255 ms (−37 %) | 5 / 39 |
| max_side 800 | 203 ms (−50 %) | 7 / 39 |

At 1200 px the saving is ~86 ms/page but one page's order changes; the cheaper settings reorder five to seven
pages. A changed reading order changes translation context and batch order, so it is a quality tradeoff for a
~0.1 s gain.

## Decision

Rejected — not shipped. Panel detection is not the ~2 s item a cold profile suggested (that number included
first-call overhead); warm it is ~0.4 s, and the downscale either saves little or changes order. Code reverted.
