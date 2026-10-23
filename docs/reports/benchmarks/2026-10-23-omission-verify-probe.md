# Semantic omission verifier (probe): 2/2 true positives on long lines where the ratio guard was blind

- **Date:** 2026-10-23 · tool `tools/omission_verify.py` (report-only), gateway verifier call on **long source lines only**
  (>= 8 English words).

## Why

The word-ratio guard cannot separate a dropped clause from a compact line (measured 2026-10-23: median ratio 1.14,
p10 0.80, low tail = titles/credits). A semantic verifier asks the gateway whether the Thai line omits a whole clause —
only on long lines, one call per page.

## Probe (10 pages of the final sweep)

- 23 long pairs checked (9 pages had any); **2 flagged, both true positives**:

| page | source | shipped Thai | verifier missing |
|---|---|---|---|
| Akuyaku p0 | `ALSO... THIS PIQUED MY CURIOSITY EARLIER IN THE DINING HALL,` | `แล้วอีกอย่าง... เมื่อตอนกลางวันในโรงอาหาร` | `this piqued my curiosity` |
| Chainsaw p1 | `THE PUBLIC SAFETY BUREAU HAS MORE PAIZ DAYS OFF` | `กรมความปลอดภัยสาธารณะมีวันหยุดมากกว่า` | `PAIZ` (paid) |

- 21 long pairs were left unflagged; spot checks look complete, so the probe shows high precision but is still a small
  sample (23 pairs).

## Cost / design

- One verifier call per page that has long lines (temperature 0, JSON-only reply). Offline tool only for now; wiring it
  into the pipeline as an opt-in retry (`MIT_OMISSION_VERIFY=1`) needs a forced-injection proof and a wider sweep first.
- The tool ships with pure-helper tests (long-line filter, prompt building, verdict parsing, flagged selection).