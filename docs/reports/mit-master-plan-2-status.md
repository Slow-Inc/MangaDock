# MIT Master Plan 2 — execution status (for the project report)

**Goal (/goal):** raise MIT manga-translation quality toward professional-human level.
**Source of truth:** `docs/prd/mit-master-plan-2.md` (12 clusters, 29 defects) · epic Slow-Inc/MangaDock#528 ·
4-reviewer findings `docs/prd/mit-master-plan-2-review-findings.md`.

This document is the honest roll-up: what is **benchmark-verified done**, what is **coded+tested**, and what is
**deferred/blocked** with the concrete reason. Every "done" below is bound to its md defect by a committed
benchmark (the plan's hard gate), not "looks better."

## Status by cluster

| P | Cluster | State | Evidence / why |
|---|---------|-------|----------------|
| **1** | readable-floor (narrow bubble → invisible text) | ✅ **DONE + benchmarked** | `benchmarks/2026-07-03-readable-floor.md` (2px→18px, defect-bound); merged PR #522 |
| **4** | bubble-polygon-fill **metric** (keystone gate) | ✅ **DONE + benchmarked** | `benchmarks/2026-07-03-polygon-spill-metric.md`; `spill_fraction_vs_polygon` merged PR #529 |
| **8** | line-break-wrap (wire Knuth-Plass) | ✅ **DONE + benchmarked** | `benchmarks/2026-07-04-knuth-plass-wire.md` (col-variance 2.6×↓, no mid-word split); merged PR #530 |
| **5** | config-defaults (2560/2048) | ✅ **VERIFIED & CLOSED** | `benchmarks/2026-07-04-config-defaults-verify.md`; default tuned, unit-locked (34/34), no low `.env` override |
| **2** | translation-context cache-safety (#524) | ✅ **CODED + TESTED** (this branch) | `benchmarks/2026-07-04-p2-cache-safety.md`; gated fix, byte-identical off, 17/17 orchestrator + 68/68 batch/config green |
| **4-fix** | safe_area corner-inscribe (kills oval-spill) | ⏸ **DEFERRED (metric-justified)** | Approach A over-shrank the Thai oval golden (reverted). The now-merged polygon metric shows corpus worst ≈ 0.12 < 0.20 ceiling → the metric does **not** currently demand the fix; forcing it risks the protected Thai target. Re-open when a captured fixture exceeds the ceiling. |
| **3** | promote reference_layout to default | 🔒 **USER-GATED** | Knob wired (`MIT_REFERENCE_LAYOUT`, default off). Flipping changes **every rendered page** for real users → high blast-radius, outward-facing; needs user OK + live E2E confirm. Gated on P4-fix being metric-green on corpus. |
| **8-enable** | enable Knuth-Plass in prod | 🔒 **USER-GATED** | `MIT_KNUTH_PLASS` wired, default off; sequence **with** P3 promote (one breaker baseline). Same prod-flip gate. |
| **6** | sfx-osb (translate SFX by default) | 🔬 **RESEARCH / M-effort** | Promotion + dedup/sanitize hardening across detect→OCR→render; needs AnimeText YOLO on the prod worker. Not a quick win. |
| **7** | llm-translation-quality (human-level levers) | 🔬 **RESEARCH — needs eval framework** | Numbered contract + glossary + determinism gate are near-zero-code, but "human-level accuracy" is **unverifiable** without the Phase-0 eval harness (#526) — the 4-reviewer consensus #1. No BLEU/COMET/human-eval exists yet (plan §7). |
| **9** | geometry-overlap (region-drop) | 🔬 **CAPTURE-FIRST** | High severity but **no deterministic repro** on audited pages. Per debug-mantra: capture before fix. Current test is a regression guard, not a fix. |
| **10** | vertical-text (`calc_vertical` re-wire) | 🔬 **SELF-CONTAINED FEATURE (M–L)** | Real per-char vertical layout is a module, not a tweak; interim readable-floor keeps vertical bubbles legible. |
| **11** | ocr-model (48px CNN → VLM routing) | 🔬 **L-effort EXPERIMENT** | Model-class gap, byte-identical to upstream (a "don't chase" target). Measured routing experiment, not a swap. |
| ~~12~~ | ~~inpaint-quality~~ | ✂️ **CUT** | Out of font/layout scope; reviewers agreed (VRAM: LaMa over Flux/SAM by ADR 003/005). |
| +30 | fragmented split-bubble clause (#527) | 🔬 **translation domain** | Depends on P7 lever work. |

## What "master plan 2 is done" honestly means right now

- **The render axis is substantially closed and verified.** The three highest-severity render/layout defects the
  deterministic harness can prove (readable-floor, polygon-spill visibility, line-break) are **merged and
  benchmark-bound**; config-defaults verified; the P2 cache-safety hole that blocked cross-page consistency is
  **coded + tested** on this branch. All are flag-gated / byte-identical, so nothing changes for production users
  until an explicit enable.
- **The remaining gap to "professional-human" is dominated by translation *accuracy*, not rendering** — and that
  is, per the plan's own §7, only *partially verifiable* with today's tooling. Closing it requires building the
  **Phase-0 translation-quality eval harness (#526)** first (all four reviewers' #1), because otherwise "human
  level" cannot be measured, only asserted. That is scoped future work, not a one-session task.

## The two decisions that are genuinely yours (user-in-the-loop)

1. **Production enable of the flag-gated render wins** (`MIT_REFERENCE_LAYOUT` + `MIT_KNUTH_PLASS`) — changes every
   rendered page; needs a live E2E A/B + your visual confirm before flipping. High value (it delivers the merged
   work to users) but high blast-radius.
2. **Invest in the eval framework (#526)?** — the prerequisite to making any P7/P11/#527 "human-level accuracy"
   claim benchmarkable. Without it those clusters can only be *contract/reproducibility*-verified, not
   *accuracy*-verified.

## Benchmark artifacts (all committed under `docs/reports/benchmarks/`)
`2026-07-03-readable-floor.md` · `2026-07-03-polygon-spill-metric.md` · `2026-07-04-knuth-plass-wire.md` ·
`2026-07-03-defect-verification.md` (honest reference_layout residuals) · `2026-07-03-comprehensive-defect-sweep.md`
(the 10-page/6-manga inventory) · `2026-07-04-config-defaults-verify.md` · `2026-07-04-p2-cache-safety.md`.
