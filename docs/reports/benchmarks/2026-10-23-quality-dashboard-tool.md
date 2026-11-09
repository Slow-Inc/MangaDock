# One-command quality dashboard (`tools/quality_dashboard.py`)

- **Date:** 2026-10-23 · aggregates the loop's measurements into a single reproducible report.

## Usage

```bash
# deterministic dashboard over a directory of doctor payloads
python tools/quality_dashboard.py --doctor-dir result/doctor/f56 \
    --audit tmp/final56_audit.json --json tmp/dashboard.json
```

It reports: pages/regions, gate violations per kind, **leftover** instances of the live guard classes
(foreign script / content loss / untranslated word / dropped question), stage-timing sums, and — when a judge audit
is supplied — the raw and **noise-adjusted** judge mean (strict classifier from `audit_summary`).

## End-state run (39-page final sweep)

```json
{
 "pages": 39,
 "regions": 368,
 "gate_violations": {"dropped_!": 1},
 "leftover": {},
 "judge": {"segments": 367, "raw_mean": 1.44, "noise_flags": 59, "adjusted_mean": 1.55}
}
```

- **0 leftovers** for every guard class across 368 rendered regions.
- The only gate finding is the known minor `dropped_!` nuance.
- Timing sums (wall 298 s over 39 pages = 7.65 s avg) match the earlier profile.
- Judge: raw **1.44**, strict noise-adjusted **1.55** (59 artefact flags removed).

Unit tests cover the aggregation (gate counts, leftover scan, dropped-payload skip, audit-adjust arithmetic), so the
dashboard number can be trusted the way the loop's hand-run numbers could not (see the classifier correction).