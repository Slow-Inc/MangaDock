# Batch pipeline and single-page path produce the same payload structure (parity check)

- **Date:** 2026-10-23 · 2 real pages, same config, both paths in one process, GPU1, real gateway.

## Result

| page | keys | size | patches | regions | rendered | dropped | source-text set |
|---|---|---|---|---|---|---|---|
| Boku p0 | same | same | 1 / 1 | 17 / 17 | 12 / 12 | 5 / 5 | **same** |
| Otome p0 | same | same | 1 / 1 | 11 / 11 | 10 / 10 | 1 / 1 | **same** |

No source line appears in one path only (translation text differs by sampling, as expected, but the region sets are
identical). So an enabled batch pipeline hands the Backend exactly the same payload shape as today's per-page path —
the opt-in switch cannot break a consumer that relies on payload structure (patches, regions, rendered/dropped
split).

This complements the earlier latency measurement (1.46x on a 2-page chapter) and the nation that batch mode keeps the
quality wins (cross-page context + name glossary).