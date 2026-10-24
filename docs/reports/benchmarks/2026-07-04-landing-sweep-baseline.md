# Landing sweep baseline (#537) — both local pages × EN+THA, live worker, all slices

Worker: `landing/render-phase0` (guard + telemetry + payload + metric + slices B/C/D + sfx_display +
SFX-filter carve-out). Prod-faithful config incl. `ocr.vlm_rescue`. `/patches` only.

| run | regions | empty | size | overlap | sibling-Δ |
|---|---|---|---|---|---|
| p1 ENG | 8 | **0** | 1* | **0** | 0 |
| p1 THA | 8 | **0** | 0 | **0** | 1† |
| p2 ENG | 8 | **0** | 1* | **0** | 0 |
| p2 THA | 8 | **0** | 0 | **0** | 1† |

- **empty=0 + overlap=0 across the board** — the guard (0b) and dedup (B) classes hold on every run.
- *size=1 on ENG = the `sfx_display` shrink (152→48px to keep SQUELCH on one line) — an intentional shrink the
  tiny-detector flags; the metric should exempt `branch=sfx_display` (noted as a harness refinement).
- †sibling-Δ=1 on THA — a same-branch pair the gate flagged for investigation; the enriched payload makes it
  attributable per region (that is the harness doing its job — baseline, not a pass/fail claim).

These four scorecards are the standing gate numbers: a render change that worsens any count does not ship.
Images: `2026-07-04-sweep-{p1,p2}-{eng,tha}.jpg`.
