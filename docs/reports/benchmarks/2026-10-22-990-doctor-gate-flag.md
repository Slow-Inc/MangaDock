# #990 wiring: `doctor_page.py --gate` — chapter replay with a deterministic pass/fail

- **Date:** 2026-10-22 · **Issue:** #990 · **File:** `tools/doctor_page.py` (one flag, no pipeline change).

`--gate` runs the quality gate over every page processed in that invocation (reading order) and prints the
violations; the command exits 1 when the gate finds a violation (or when the doctor already flags a page — the
page diagnosis and the gate share the exit signal by design).

## Validation

| invocation | gate output |
|---|---|
| legacy Tsuki p0 replayed from the run that shipped the Cyrillic bug | `foreign_script` at #5 and #6, `violations=2 ok=False` -> **exit 1** |
| 2 fresh live pages (Boku p0 + Mieruko p0) | `pages=2 violations=0 ok=True` (exit reflects the doctor's own page flags) |

So the wiring catches a historically shipped defect class on replay and stays quiet on clean pages. Replay is
still per-page (`--replay` takes one dump); for a multi-page chapter A/B the dump-based replay remains
single-page, which is why the gate lives on the whole invocation's pages.