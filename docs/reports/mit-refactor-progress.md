# MIT Refactor — Progress Tracker & Resume Point

> **Single entry point** for the MIT tech-debt decomposition. If context was lost, READ THIS FIRST,
> then the linked docs. It tracks exactly which decomposition seams are done, which is next, and the
> landmines that must be preserved — so no one has to re-explore or re-analyze. Last updated 2026-06-09 (S2 done).

## How to resume (read order)
1. **This file** — current position + seam status table below.
2. `docs/research/mit-core-decomposition-analysis.md` — the verified map: 26 seams (S1–S26) with
   interfaces, kind, risk, **per-seam test strategy**, dependencies, the **16 landmines**, and the safe order.
3. `docs/reports/tech-debt-remediation-plan.md` — the roadmap + the 2026-06-09 reconciliation (seam-based,
   interleaved, not monolithic Phase-C).
4. `docs/research/translator-deep-dissection.md` + `docs/research/render-parity-port-plan.md` — the
   MangaTranslator reference dissection and the render-parity gap plan (#166–#183, #168, #180).
5. `docs/reports/system-impact-report.md` — per-change before→after / perf / quality / validation records.
6. `DONE.md` — chronological dev log. `.claude/memory/*` — the standing rules (boundary, all-scenarios,
   report-on-close, impact-report).

## Governing rules (must follow every seam)
- **Characterization net first**, then extract **byte-identical**, prove with the seam's test gate, ship +
  report, one commit per seam. (`feedback_techdebt_all_scenarios`, `feedback_core_boundary`.)
- **Preserve landmines verbatim**; fix them only later behind an **opt-in flag** (never silently).
- New features attach at a seam with tests — never grow the god object. Never merge without user confirm.

## Landmines to PRESERVE during extraction (see analysis §3 for file:line)
- **L1 TTL key drift** — `'colorizer'` never matches `case 'colorization'`; `'textline_merge'`/`'rendering'`
  have no case → those models are timestamped but never TTL-unloaded. Keep as-is in S3/S4.
- **L6 divergent validation (load-bearing)** — `min_ratio` 0.5 (single/batch) vs 0.3 (concurrent);
  region threshold 6 (single/concurrent) vs >10 (batch). Unifying = behavior change. Keep as params in S18.
- **L7 context-window asymmetry** — single appends per-page; batch appends after the whole batch; concurrent
  uses original text. Different prompts for same input — preserve in S16.
- **L9 singleton page-context bleed** (#136/#140) — `reset_page_context` only fires from `translate_patches`;
  `translate`/`translate_batch` accumulate forever on the `share.py` singleton. Make explicit in S16.
- **L2 `exit(-1)` in a stage**, **L10 `zip()` truncation**, **L14 cleanup-task leak**, **L3 none-translator
  returns unfiltered**, **L5 always-None `from_lang`/`render_mask`** — preserve; do not "tidy".

## Seam status (S1–S26 + the already-landed pre-seams)

Legend: ✅ done · ▶️ next · ⬜ todo · 🔒 blocked-by. Full interface/test-strategy per seam: analysis §4.

| Seam | What (short) | Kind | Risk | Status | Commit / depends |
|------|-------------|------|------|--------|------------------|
| — | `correct_punctuation` (punct step, pre-S18) | pure | low | ✅ | `e781e16` (#187c) |
| — | `translation_checks` repetition + ratio (S18 validators) | pure | low | ✅ | `cdb1982`,`67b671d` (#187a/b) |
| — | `_greedy_pack` line-break seam (#186) | async-orch | — | ✅ | `778d144` (#186) |
| #192a | `TranslatorChain` parse → `translator_chain.py` | pure | low | ✅ | `33cec29` |
| #192b | remove dead `_batch_contexts/_configs` | — | low | ✅ | `eae3e02` |
| **S1** | `filter_translated_regions` (3-way filter dedup) | pure | low | ✅ | `a71e4d2` |
| **S2** | `apply_translations` / `apply_original_as_translation` (fold 4 copies + casing) | pure | low | ✅ | `region_apply.py` (branch `refactor/mit-seam-s2-apply-translations`) |
| **S3** | `ModelUsageTracker` (wrap `_model_usage_timestamps`; **#188 starts**) | stateful | low | ▶️ next | — |
| **S4** | `ModelUnloader` (routing table; preserve L1) | stateful | med | ⬜ | S3 |
| **S5** | `memory_pressure_guard` (gc/empty_cache/psutil) | stateful | low | ⬜ | — |
| **S7** | `context_page_counts` (fold accounting) | pure | low | ⬜ | — |
| **S8** | `PostDictionaryStage` (fold post-dict) | stateful | low | ⬜ | — |
| **S6** | `build_prev_context` pure fn (per-mode index policy explicit) | pure | med | ⬜ | — |
| **S9** | `NoneTranslator/GuardPolicy` (front-matter, L3/L12) | stateful | med | ⬜ | — |
| **S10** | `TranslationFileSideChannel` (load/save_text; L2 `exit(-1)`) | stateful | med | ⬜ | — |
| **S11** | `ImageDebugContext` (result_path + MD5 swap) | stateful | med | ⬜ | — |
| **S12** | `PipelineParams` + `apply_global_settings` (needs #192) | mixed | med | ⬜ | #192 |
| **S20** | `ModelReaper` (TTL loop; opt-in `.stop()`, L14) | async-orch | med | ⬜ | S3,S4 |
| **S15** | Stage protocol over 8 `_run_*` (**#187 core begins**) | async-orch | low | ⬜ | S3 |
| **S13** | `DetectionPostProcessor` (formalize `_merge_sfx_detections`) | stateful | low | ⬜ | S15 |
| **S16** | `TranslationMemory` (the two lists + bleed boundary, L9) | stateful | med | ⬜ | S6 |
| **S21** | `ModelLifecycle` facade + preload (#188 facade) | async-orch | high | ⬜ | S20 |
| **S17** | `TextTranslationDispatcher` (collapse duplicated switch) | async-orch | high | ⬜ | S6/S16,S11 |
| **S18** | `PostTranslationProcessor` (unify 4 copies; pin L6/L8 as params) | async-orch | high | ⬜ | S1,S2,S8,S17 |
| **S19** | `gather_per_context` (per-exception placeholder) | async-orch | med | ⬜ | S2 |
| **S14** | `VerboseDebugSink` (cv2.imwrite/OCR-env/streaming) | stateful | med | ⬜ | S18 |
| **S23** | `StageRunner` (uniform progress + try/except policy) | async-orch | high | ⬜ | S15,S11,S14 |
| **S24** | `PatchRenderer` (extract `_process_group`; share.py:99 contract) | async-orch | med | ⬜ | S23 |
| **S22** | `DispatchRegistry` (onto existing `ModelWrapper`; #188 downstream) | stateful | high | ⬜ | S4 |
| **S25** | `PipelineOrchestrator` (drive stage-list; remove dead 'cancel') | async-orch | high | ⬜ | S23 |
| **S26** | `BatchModeOrchestrator` (**last**; MemoryError ladder) | async-orch | high | ⬜ | S23,S18,S17,S16,S11 |

## Tech-debt issues (GitHub `Slow-Inc/MangaDock`, label `MIT`)
| Issue | Title | Status |
|---|---|---|
| #186 | `calc_horizontal` → pluggable LineBreaker seam | seam extracted (`_greedy_pack`); #180 wiring pending |
| #187 | MangaTranslator god object → stage orchestrators | in progress (S1+S2 done; S3 next) |
| #188 | model load/lifecycle + translator base abstractions | starts at S3 (interleaved early) — ▶️ next |
| #189 | glyph-render dedup (`put_char` h/v + stroke) | open (orthogonal, render) |
| #190 | `resize_regions_to_font_size` + box-padding decompose | open (orthogonal, render) |
| #191 | vendored LDM (~3000 LOC) + YOLOv5 trim | open — **investigate first**: is SD/LDM dead? |
| #192 | config centralize + cleanup | partial (a TranslatorChain + b dead fields done; load_dotenv deferred low-ROI/high-risk) |
| #193 | worker `--start-instance` lifecycle (5003/5004) | open (cheap, independent) |

## Related / not-yet-applied
- **#180 Knuth-Plass wiring (step 2)** — `line_break.py` pure module done (`9739b9d`); wire into the `_greedy_pack`
  seam behind a knob — unblocked, pending.
- **Render-parity knobs shipped** (opt-in, byte-identical off): `MIT_EN_UPPERCASE`, `MIT_FONT_MAX_BOX_RATIO`,
  `MIT_EN_FONT`, `MIT_SFX_DETECTOR` (#168 AnimeText), plus #166/#170/#175/#176/#179/#181/#183. See report.
- **Ubiquitous-language workflow output** (7-agent comprehensive glossary, EN+TH) ran but is **not yet assembled**
  into `UBIQUITOUS_LANGUAGE.md` (current file has the manually-added MIT pipeline/render terms only).
