# Semantic omission verifier (probe): 2/2 true positives on long lines where the ratio guard was blind

- **Date:** 2026-10-23 · tool `tools/omission_verify.py` (report-only), gateway verifier call on **long source lines only**
  (>= 8 English words).

## Why

The word-ratio guard cannot separate a dropped clause from a compact line (measured 2026-10-23: median ratio 1.14,
p10 0.80, low tail = titles/credits). A semantic verifier asks the gateway whether the Thai line omits a whole clause —
only on long lines, one call per page.

## Probe (full 39-page final sweep)

- 33 pages carried long lines (**85 long pairs**); **2 flagged, both true positives**:

| page | source | shipped Thai | verifier missing |
|---|---|---|---|
| Akuyaku p0 | `ALSO... THIS PIQUED MY CURIOSITY EARLIER IN THE DINING HALL,` | `แล้วอีกอย่าง... เมื่อตอนกลางวันในโรงอาหาร` | `this piqued my curiosity` |
| Komi p1 | `CAN KOMLMAKE IOO FRIENDS?SPECIAL CHALLENGES CALL FOR SPECIAL MEASURES EDIT` | `คอมิจะหาเพื่อนได้ไหม? ความท้าทายพิเศษต้องใช้มาตรการพิเศษ` | `100 (IOO)` (plus a credit `EDIT`, ignorable) |

- **Run-to-run stability caveat:** the earlier 10-page probe also flagged Chainsaw p1 (`PAIZ`/paid modifier) and Akuyaku; the full sweep re-flagged Akuyaku and Komi but **not** Chainsaw, so the verifier is not perfectly deterministic across runs. Akuyaku was flagged in both runs; the other two each appeared once. As a report-only QA lead generator that is acceptable; as an automatic retry trigger it would need repeat-agreement (e.g., two verifier passes) or a stricter prompt.

## Cost / design

- One verifier call per page that has long lines (temperature 0, JSON-only reply): 33 calls for 39 pages, 85 long pairs —
  cheap enough for an audit, too costly as a default per-page step. Offline tool only for now; wiring it into the
  pipeline as an opt-in retry (`MIT_OMISSION_VERIFY=1`) needs: repeat-agreement between two verifier passes, a
  forced-injection proof, and a precision sweep across more pages.
- The tool ships with pure-helper tests (long-line filter, prompt building, verdict parsing, flagged selection).
## Two-pass agreement (added after the instability finding)

The tool now supports `--passes N` and flags a pair only when **every pass** agrees (`combine_passes`). Full corpus
with `--passes 2` (33 pages with long lines, 85 pairs, 66 verifier calls):

| outcome | count | examples |
|---|---|---|
| **agreed** (both passes) | **2** | Akuyaku `this piqued my curiosity`; Komi `100 (IOO)` — both clear true positives |
| **disagreed** (one pass only) | 2 | Horimiya `won't give my pen back` -> `ให้ปากกาคืนมา` (tense nuance, borderline); Osoraku `THE OTHER THREE` -> `คนอื่น` (the number `three` dropped, minor) |

So two-pass agreement keeps the high-confidence omissions and drops the borderline ones — usable for an opt-in
audit/retry path, at 2x verifier calls (66 calls / 39 pages). Still report-only in the pipeline; integration needs the
forced-injection proof next.