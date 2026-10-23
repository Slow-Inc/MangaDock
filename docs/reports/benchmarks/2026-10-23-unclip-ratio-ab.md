# Detector `unclip_ratio` A/B: 2.3 vs 2.6 fixes the DEFEND case but is overall parity — default unchanged

- **Date:** 2026-10-23 · full 39-page corpus, same tuned config, only `detector.unclip_ratio` changed; judge over every page.

## Why

Round 172 found OCR misreads are textline-box-geometry bound: at default `detection_size 2560` the detector box clipped
the `F` in `DEFEND`, the OCR read `DEEEND`, and the translation shipped `ทำลาย` (destroy — opposite meaning).
`unclip_ratio` (default **2.3**, how far the detector expands the text mask into a box) is the knob that grows that box
without moving the page layout.

## Result

| metric | unclip 2.3 (f106) | unclip 2.6 (u26) |
|---|---|---|
| Otome p1 `DEFEND` line | `DEEEND` -> translated destroy | **`DEFEND` -> translated protect** |
| source strings changed | — | **119 / 365 (32.6 %)** |
| pages whose region count changed | — | **8 / 39** |
| judge mean (all pages) | **1.44** (367 segs) | **1.39** (363 segs) |
| paired page wins / losses | — | 19 / 16 / 3 same |
| guard triggers | 16 | 8 |
| gate violations | 1 (name) | 5 (name + credit lines) |

- The judge delta (-0.05) is **inside the loop's noise band** and page wins/losses are parity, while a third of the
  source strings and eight page layouts change. The win is real but local (Otome 0.80 -> 1.40, Taida 1.25 -> 2.00,
  Kumo 1.00 -> 2.00) and the losses are equally real (Tsuki 1.79 -> 1.14, Mieruko 1.67 -> 1.17).

## Decision

**Default stays 2.3.** `unclip_ratio` is already an exposed config knob; page-specific OCR triage may try 2.6 locally,
but promoting it would trade a clean layout for a wash in quality. The root fix for the class remains the planned
**localized re-detection at higher resolution around suspicious lines**, not a global box expansion.
## Threshold search and the 2.4 sweep

To separate "box expansion" from "big global change", ran a second full sweep at **2.4** and a fine threshold search on
the Otome page:

| unclip_ratio | Otome `DEFEND` read | source strings changed (39 pages) | pages with region-count change |
|---|---|---|---|
| 2.3 (default) | `DEEEND` | — | — |
| 2.4 | `DEEEND` (still broken) | **79/366 (21.6 %)** | 7 |
| **2.45** | **`DEFEND`** | (not swept) | — |
| 2.5 | `DEFEND` | (not swept) | — |
| 2.6 | `DEFEND` | 119/365 (32.6 %) | 8 |

Two conclusions:

1. The Otome fix needs only **+0.15** (2.45); it is a real, cheap box expansion on that page.
2. But even the *smallest* expansion that keeps the page mostly intact (2.4) already rewrites **21.6 % of all source
   strings and 7/39 page layouts** — the detector resizes/merges boxes globally, not just on the clipped line.

So a global `unclip_ratio` bump cannot be a targeted fix: the cost (layout/prompt churn across the chapter) is
unavoidable at any setting that changes anything. This is the same shape as the earlier `detection_size` rejection and
confirms the local re-detection design: expand the box **only around a suspicious line**, at a higher resolution.