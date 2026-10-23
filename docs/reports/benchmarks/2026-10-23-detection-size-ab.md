# detection_size 2048 vs 2560: faster on paper, different detections — rejected on the quality gate

- **Date:** 2026-10-23 · 6 real pages, TUNED config, GPU1, `--set detector.detection_size`.

## Timing

| page | wall 2560 | wall 2048 | detection 2560 | detection 2048 |
|---|---|---|---|---|
| Boku p0 | 13.7 s | 13.3 s | 5.28 s (cold) | 5.33 s |
| Otome p0 | 5.4 s | 5.5 s | 0.55 s | 0.48 s |
| Horimiya p1 | 9.9 s | **6.7 s** | 0.67 s | 0.58 s |
| Maou p1 | 9.8 s | **6.4 s** | 0.77 s | 0.65 s |
| Mieruko p0 | 6.2 s | **5.4 s** | 0.54 s | 0.45 s |
| Dungeon p0 | 3.9 s | **3.1 s** | 0.70 s | 0.37 s |

The detection stage itself saves only **0.1-0.3 s**; most of the wall difference is translation sampling variance.

## Quality gate: region sets differ

Comparing the rendered region sets per page: **Boku 12 -> 11 regions, Maou 11 -> 10, Mieruko 11 -> 12**, and every
page's OCR text set differs in 1-6 segments. A different detector size changes which boxes are found, i.e. it is a
**recall change**, not a free speed knob.

## Decision

**Keep 2560 as the default** (the loop chose it for quality earlier, like the 3200 rejection): 2048 buys ~0.1-0.3 s
on the detection stage at the cost of altered detections, which the quality-first rule does not accept without a
corpus-wide recall proof. No code change.