# Live quality sweep + fresh latency profile at HEAD (2026-10-22, round 37)

## Live quality sweep (no defects found)

Ran 8 risk pages **live** (Tsuki p0, Otome p0, Kage p0, Akuyaku p0, Mieruko p0, Boku p0, Horimiya p0,
Iruma p1 — chosen for names, long captions, SFX) plus the two #903 verification runs, then scanned every fresh
segment with all detectors:

| detector | hits |
|---|---|
| foreign script leak (`leaked_script`) | **0** |
| runaway length (#901) | **0** |
| truncation (dst < 25 % of src, src >= 20) | **0** |
| duplicate dst >= 3 within a page | **0** |
| doubled Thai marks | **0** |
| name transliteration inconsistent within a page | **0** |
| empty dst | **0** |
| passthrough (dst == src) | 1 (SFX) |

139 segments over 10 files. Render metrics on those pages: overlap **0**, spill **0**, small_font **0**.

## Warm latency profile (one process, pages 2-4 warm)

| page | wall | detection | ocr | merge | **translate** | mask | inpaint | render |
|---|---|---|---|---|---|---|---|---|
| Boku p0 (cold) | 10.4 s | 3634 | 1130 | 445 | 2620 | 90 | 387 | 849 |
| Mieruko p0 | 4.2 s | 494 | 1055 | 164 | 1629 | 229 | 260 | 210 |
| Horimiya p0 | 7.6 s | 494 | 1180 | 580 | 4230 | 257 | 345 | 263 |
| Tsuki p0 | 8.6 s | 439 | 1558 | 225 | 5426 | 248 | 315 | 224 |

- **Translation dominates**: 39-63 % of warm wall (1.6-5.4 s), gateway-bound, single call per page.
- Non-translation work is ~2.3-3.0 s: detection ~0.45 s, OCR 1.0-1.6 s (the accepted #884 cuDNN-off cost),
  merge 0.2-0.6 s, mask ~0.25 s, inpaint ~0.3 s, render ~0.2 s (supersampling 4).
- Cold start (model load) is ~3.6 s of detection on the first page of a process.

## Next candidate (designed for the #902 calibration)

Translation is the only large lever left, and it runs with thinking enabled. The calibration says a 12-page A/B
cannot resolve a prompt/thinking difference — but a **~150-segment, segment-level binomial** design can: the
40-line synthetic JP set plus the 11-page EN set, thinking on vs off, judged blind, reported as decided
segment counts with ties. If thinking off holds quality (within the binomial interval), it is the largest
latency win available; if not, it stays as is.
