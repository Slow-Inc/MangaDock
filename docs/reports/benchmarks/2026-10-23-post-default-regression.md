# Post-default regression audit: the two new defaults keep quality at baseline (7 pages, judge 1.45/2)

- **Date:** 2026-10-23 · after promoting **#1051** (source-language filter after the noise strip, default ON) and the
  **series name memory** (default ON). 7 real pages, real gateway, GPU1, `--no-png` + gate + `MIT_LOG_GLITCH=1`.

## Results

| metric | value |
|---|---|
| pages | 7 (Mieruko, Kage, Boku, Otome, Maou, Horimiya, Chainsaw) |
| gate | **0 violations** |
| glitch triggers | **0** (no retries needed) |
| series-glossary fixes | 0 — expected: `doctor_page` sends no `series_context`, so the path is a strict no-op |
| judge | **91 segments, mean 1.45/2, zero 0-score segments** |

## Comparison

Full-corpus baseline from earlier audits: **1.44/2** over 403 segments (batches ranged 1.36-1.58). The post-default
sample sits exactly on that baseline, so neither new default regressed translation quality; the filter move is a
pure latency win (translation 3.62 -> 2.12 s on a mixed page in the earlier A/B), and the name memory only acts
when a series context is present.