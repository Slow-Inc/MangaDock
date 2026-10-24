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
## Follow-up (round 7): chapter-level deterministic replay + `--gate-only`

- **`--replay` now accepts one or more dumps** (`nargs='+'`): one dump for all pages (previous behaviour) or
  **one per page in reading order**. `_install_replay` takes a recorded dict *or a callable* returning the
  current page's dict — without that, stacking installs would capture the previous wrapper and cross-map pages.
- **`--gate-only`**: exit nonzero **only for gate violations** (the doctor's page flags still print), so CI can
  gate on quality without being flipped by the diagnostic table.

| validation | result |
|---|---|
| two-page legacy Tsuki chapter replay (dumps from the runs that shipped the Cyrillic bug) | `[gate] violations=5 ok=False` (4 foreign-script + 1 inconsistent name) -> **exit 1** |
| two-page clean chapter replay (live dumps) | `[gate] pages=2 violations=0 ok=True` -> **exit 0** with `--gate-only` |

Multi-page replay is deterministic for recorded texts; unseen texts still go live once (printed as
`[replay] N/M texts unseen`).