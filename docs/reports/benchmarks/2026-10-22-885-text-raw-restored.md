# #885 `text_raw` reaches the regions the pipeline keeps — no render change, record keys fixed

- **Date:** 2026-10-22 · **Issue:** #885 · **Change:** the raw-OCR-text stamp now runs on the ONE dispatch whose output is used.
- **Why it was lost:** the merge stage dispatched twice; `text_raw` was stamped on the first result, whose `TextBlock`s `dispatch()` then discarded. Consumers (`renderers` scaling a longer translation, the page-translation record key, the batch record) silently fell back to post-normalisation text.

## Evidence

| check | result |
|---|---|
| instrumented replay (Dungeon p0) | **6 / 6** merged regions carry `text_raw` |
| raw vs rewritten sample | `I'VE BEEN KILLED BY IT SO MANY TIMES...` (raw) vs `IVE BEEN KILLED BY IT SO MANY TIMES...` (the text consumers used to see) |
| render A/B, change stashed on 3 deterministic replay pages | **renders byte-identical**, 0 region diffs (no pre-translation dictionary in this config, so the default outcome is unchanged) |
| helper refactor vs inline version | render byte-identical |
| tests | 3 new helper tests (`stamp_text_raw`); torch-free gate **833 passed** |

## Why it matters

The remaining value is correctness rather than a visible render on this corpus: with a configured pre-translation
dictionary (or the legacy scaling path, rendering:792) the pipeline now scales and keys on the raw OCR text
again, which is what the code comments intended.
