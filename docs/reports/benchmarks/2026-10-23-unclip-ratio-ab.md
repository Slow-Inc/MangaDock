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