# Batch pipeline vs production single-page: 1.46x faster and names consistent; quality within judge noise (#905)

- **Date:** 2026-10-23 · 2-page real chapter (Tsuki c2 p0/p1), GPU1, real gateway.

## Latency

| arm | wall (2 pages) |
|---|---|
| production single-page (`translate_patches` per page) | **29.4 s** |
| batch pipeline (`translate_batch_pipelined`) | **20.2 s** |
| speedup | **1.46x** |

## Quality

- **Deterministic:** the batch path's name glossary keeps `TSUKUYOMI` consistent across the chapter
  (`ทสึคึโยมิ` on both pages); the single-page path produced two spellings (`สึกุโยมิ` vs `ทสึคึโยมิ`, gate
  `inconsistent_name`).
- **Judge:** single **1.55/2** (33 segments), batch **1.39/2** (33 segments). The gap is inside the noise band this
  loop measured for the *same* single-page config across repeated runs (1.36-1.58), and most lowered flags are the
  judge's known Thai-spelling/tone false positives (`ไม่มี→ไม่มี`, `ฉัน→ฉัน`). No deterministic quality regression
  was found; one style complaint (threat phrasing) and one lost-vulgarity flag are sampling differences.
- **Tradeoff recorded:** batch mode reports no live per-page progress and holds more memory; therefore it stays
  opt-in (`MIT_BATCH_PIPELINE=1`).

## Recommendation

For chapter jobs that do not need per-page live progress, enabling the batch pipeline is a real win: ~1.5x and
consistent character names, with quality indistinguishable at the judge's resolution. Revisit the default once the
Backend progress UX no longer depends on per-page callbacks. The glossary currently freezes whichever spelling page 1
used (even if the vowel is imperfect) — consistency is the guarantee, not the spelling itself.