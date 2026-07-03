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
| **0** | translation-quality eval harness (#526, reviewers' #1) | ✅ **HARNESS BUILT + TESTED** (this branch) | `MIT/eval/translation_eval.py` (stdlib, 9 tests <0.1s): eval-set + seeded-balanced blind A/B + 0-2 rubric + per-axis/type aggregation + scorecard. Real 100-bubble run + human grading = next step. Makes P2/P6/P7 falsifiable. |
| **4-fix** | safe_area corner-inscribe (kills oval-spill) | ⏸ **DEFERRED (metric-justified, MEASURED 2026-07-04)** | Ran the polygon metric across the whole committed corpus: worst `spill_frac_poly` = **0.122** (thai-gy-ds4) < **0.20** ceiling; One-Punch 0.000, Thai fixtures 0.020–0.122 (real but tolerable). The metric does **not** demand the fix. Geometry check: strict corner-inscribe of an ellipse shrinks each axis to ~0.707 (area halves) → would drop the Thai fill golden below its `final_fs≥24` floor (the §7 over-shrink warning, confirmed). The user's live-caught oval (`มีอยู่หนึ่งอันนะ`, 2026-07-03) is **not** in the corpus → this is **capture-first**: capture that bubble (needs the non-deterministic translator) → measure → only then TDD a fix if it exceeds the ceiling. Not forced. |
| **3** | promote reference_layout to default | 🔒 **USER-GATED** | Knob wired (`MIT_REFERENCE_LAYOUT`, default off). Flipping changes **every rendered page** for real users → high blast-radius, outward-facing; needs user OK + live E2E confirm. Gated on P4-fix being metric-green on corpus. |
| **8-enable** | enable Knuth-Plass in prod | 🔒 **USER-GATED** | `MIT_KNUTH_PLASS` wired, default off; sequence **with** P3 promote (one breaker baseline). Same prod-flip gate. |
| **6** | sfx-osb (translate SFX by default) | 🔬 **RESEARCH / M-effort** | Promotion + dedup/sanitize hardening across detect→OCR→render; needs AnimeText YOLO on the prod worker. Not a quick win. |
| **7** | llm-translation-quality — contract + determinism gates | ✅ **GATES BUILT + TESTED + BENCHMARKED** (this branch) | `translators/numbered_contract.py` (stdlib, 15 tests): `normalize_numbered_output` (exactly-N, kills page-wide misalignment on a dropped index — 7/8→8/8) + `is_deterministic_decode`. Benchmark `2026-07-04-p7-contract-determinism.md` surfaces the **real finding: production runs `temp=0.5` = non-reproducible**. **Accuracy** (glossary/voice + is temp=0 *better*) still needs the #526 human-eval A/B — the gate for that claim. |
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

## Resume here (next session — exact entry points)

**Branch:** `fix/mit-mp2-p2-p5` (PR #532, off `main`). MP2-work worktree: `.claude/worktrees/mp2-work`
(Backend `node_modules` junctioned from the main checkout; MIT tests via the main `MIT/.venv` python:
`/d/Github/MangaDock/MIT/.venv/Scripts/python.exe -m pytest MIT/test/<f>.py -p no:cacheprovider --noconftest -q`).

**A — real #526 eval run (measures "human-level"; needs the user for data + grading):**
1. Pick a series with an **official English translation** (One-Punch is in the corpus + has official EN).
2. Assemble `MIT/eval/<series>_eval_set.json` — 100 items `{id, source, candidate (MIT), reference (official EN), bubble_type, config_label}`, spanning dialogue+narration+sfx. Candidate = run MIT `/translate/with-form/patches` (tagged) and pull `regions[].dst`.
3. `make_blind_pairs(items, seed)` → grade blind (person B) → `RubricScore` + A/B prefs → `aggregate` → `render_scorecard` → commit to `docs/reports/benchmarks/`. This is the **P2 context ON/OFF A/B** too (two `config_label`s).

**B — P7 llm-translation-quality (autonomous code; contract-tests are the accepted gate — accuracy via A above):**
- Numbered-contract repair lives in `MIT/manga_translator/translators/chatgpt.py::_translate_batch` (`re.split(r'<\|\d+\|>')` at ~:323, mismatch handling ~:340-390) — **refactor** that ad-hoc count handling into a pure `normalize_numbered_output(raw, n)` (pad misses → `[Missing item N]`, keep `[OCR FAILED]`, truncate extras) + unit tests (a net simplification, not a new layer).
- Determinism gate (7c): `temperature`/`top_p` set at `chatgpt.py:728-729` from `self.temperature`/`self.top_p`; add `is_deterministic_decode(temp, top_p, top_k)` and only treat a run as cacheable/replayable when true. Same-fixture-twice-at-temp0 → byte-identical test.
- Glossary (7b): `OPENAI_GLOSSARY_PATH` seam (`load_glossary` ~:836) for recurring romaji names/shouts.

**C — P3+P8 prod enable (user-gated, high blast-radius):** set `MIT_REFERENCE_LAYOUT=1` + `MIT_KNUTH_PLASS=1` in
`Backend/.env`, cache:reset, render the defect pages via `/translate/with-form/patches`, before/after image, **user confirm** before calling done.

**P4-fix:** capture-first only (corpus worst spill 0.122 < 0.20; don't force — see the P4-fix row above).

## Benchmark artifacts (all committed under `docs/reports/benchmarks/`)
`2026-07-03-readable-floor.md` · `2026-07-03-polygon-spill-metric.md` · `2026-07-04-knuth-plass-wire.md` ·
`2026-07-03-defect-verification.md` (honest reference_layout residuals) · `2026-07-03-comprehensive-defect-sweep.md`
(the 10-page/6-manga inventory) · `2026-07-04-config-defaults-verify.md` · `2026-07-04-p2-cache-safety.md`.
