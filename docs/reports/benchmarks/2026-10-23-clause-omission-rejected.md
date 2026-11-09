# Clause-omission guard: measured and rejected (word-ratio cannot separate omission from compact titles)

- **Date:** 2026-10-23 · mining over stored doctor payloads, `pythainlp` word counts.

## Measurement

For 7,080 segments (English source >= 5 words, Thai target): ratio = Thai word count / English word count.

| stat | value |
|---|---|
| median | 1.14 |
| p10 | 0.80 |
| low tail (< 0.5) | almost entirely **titles/credits** (`Comi san ha Comyusho desu Contents` -> `เนื้อหา`, `Class 1 Drivers Licens…` -> `ใบขับขี่รถยนต์ส่วนบุคคล`) — compact but correct |

A real clause omission inside a long sentence (`this piqued my curiosity` dropped while the rest is translated) leaves
the ratio around 0.7-0.9, i.e. **inside the normal band** — the signal is not separable from legitimate compact lines.

## Decision

**No guard.** A word-ratio predicate would fire mostly on titles/credits and miss the actual omissions; the class
stays with the model (already documented as model-ceiling in the noise-adjusted profile). The idea is recorded so a
future session does not rebuild it without a different signal (e.g., a semantic verifier).