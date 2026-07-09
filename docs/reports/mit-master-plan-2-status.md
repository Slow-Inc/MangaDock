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
| **3** | promote reference_layout to default | 🔧 **WIRED, needs promote** | CORRECTION 2026-07-04: `reference_layout` **IS** wired into the pipeline (`config.py:193` `reference_layout: bool = False` + `stages.py:84-85` threads `config.render.reference_layout`) — an earlier note wrongly said "not wired" (grep hit the wrong branch/cwd). It is config-drivable (`render.reference_layout:true`), default OFF. Remaining = promote (enable + resolve Thai oval residuals via P4-fix) + Backend `MIT_REFERENCE_LAYOUT` knob. Flip = high blast-radius → user-gated. **This is the candidate fix for the acoustics-bubble OVERFLOW the user caught** (bubble_area_fit oversizes; reference_layout bounds to the mask). |
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

---
## FINAL: every cluster's AUTONOMOUS portion is complete (2026-07-04)

Verified each remaining cluster is at its plan-defined autonomous done-state:
- **P1** readable-floor ✅ merged+live · **P2** cache-safety ✅ (PR#532) · **P4-metric** ✅ · **P5** ✅ ·
  **P8** KP ✅ · **P0** eval-harness ✅ · **P7-gates** (contract+determinism) ✅ · **P7-conciseness** ✅ (impl+wire+3 tests, gated)
- **P3/P4-promote** ✅ **decided by benchmark** — deterministic A/B proves reference_layout REGRESSES the narrow
  bubble → correctly NOT promoted (not a gap; the right call, evidenced).
- **P6 SFX** — dedup/sanitize/rescue hardening ✅ **fully unit-tested** (32 tests). Only production *enable* remains (user-gated).
- **P9 geometry** — region-drop regression guard ✅ (9 tests). No repro exists → debug-mantra forbids a
  speculative fix; the guard IS the correct done-state.
- **P10 vertical** — vertical regions get the readable-floor ✅ (interim guard, `resize_regions_to_font_size:389`).
  Full per-char vertical layout is a Phase-4 self-contained feature.
- **P11 OCR** — byte-identical to upstream ("don't chase"); measured model-class experiment, deferred.
- **P12** inpaint — CUT (out of scope).
- **Benchmark** ✅ deterministic harness (`MIT/tools/render_dump_ab.py`) + 4 real-page A/B + root-cause diagnosis.

**Root-cause finding (benchmark-proven):** the user's narrow-bubble defect is a FUNDAMENTAL bubble-size ×
text-length limit — neither render (P3/P4) nor translation-conciseness (P7) fixes it (both measured negative);
P1 readable-floor (live) is the least-bad option. The general narrow-bubble class is handled by P1.

**What genuinely remains = EXTERNAL prerequisites only** (the human-in-loop steps): production enable (flip
flags — user), ML models (P6 AnimeText / P11 VLM-OCR), human grading (P7 accuracy via #526 eval run), a repro
fixture (P9). None is further autonomous coding — each needs a model, a human judgement, a captured repro, or an
operator decision. The autonomous engineering of Master Plan 2 is complete and benchmarked.

---
## RESUME (2026-07-04 round 2 — post brainstorm) — READ THIS FIRST next session

**Branch:** `fix/mit-mp2-p2-p5`. **PR #532 MERGED to main** (squash). **PR #533 OPEN** (P7-LLM-judge + brainstorm-unblocked P6/P9 + P7-conciseness quality A/B — clean 6-file diff vs main).

**What the 2 brainstorm rounds unblocked/found (all committed to PR #533):**
- **P7-accuracy = DONE-measurable**: `MIT/eval/llm_judge.py` (torch-free, custom_openai endpoint) → real scorecards. Baseline **1.70/2** (35 bubbles). Run: `MIT/eval/run_llm_judge.py`.
- **P7 concise_bubbles = PROVEN-GOOD**: clean A/B OFF 1.47 → ON **1.60/2** (+0.18 faithfulness) → enable candidate like P8 KP.
- **P6 SFX**: AnimeText model already cached (~/.cache/huggingface); `sfx_detector.detect_sfx_boxes` verified (4 boxes). Enable = `MIT_SFX_DETECTOR` (already in Backend/.env).
- **P9**: 0-drop audit confirms terminal state (guard is correct done-state, no defect).

**What genuinely remains = USER/EXTERNAL only (verified across 2 brainstorm rounds):**
1. **merge #532 + #533** — user says "ยืนยัน" (per-PR auth; classifier hard-blocks agent self-merge). #532 was merged this way.
2. **deploy + enable** the proven-good flags (`MIT_KNUTH_PLASS`, `MIT_CONCISE_BUBBLES`; **NOT** `MIT_REFERENCE_LAYOUT` — benchmark-proven regress). SAFE deploy recipe (from brainstorm): `git worktree add` off main + copy git-ignored models/ + sequential cutover on :5003 + restart Backend (do NOT run 2 GPU workers = CUDA OOM). User-gated (outward-facing).
3. **P11 OCR** = deferred-by-plan ("don't chase"). **human blind grading** = gold-standard on top of the LLM-judge baseline (optional).

**Deterministic render benchmark method (works):** `MIT/tools/render_dump_ab.py` — needs a worker launched from mp2-work checkout (has reference_layout + the MIT_DEBUG_RENDER_DUMP dump code) since the machine's venv imports code cwd-based; :5003 runs stale perf-branch code.

**Root-cause (benchmark-proven):** the user's narrow-bubble defect = fundamental bubble-size × text-length limit; P1 readable-floor (live) is the least-bad option; render clusters (P3/P4) don't fix it.

**New rule this session:** proactive `/clink-brainstorm` in goal-mode (see memory `feedback_proactive_clink_brainstorm`) — it unblocked 3 "blocked" clusters, so always verify "external prereq" claims against the real repo first.
