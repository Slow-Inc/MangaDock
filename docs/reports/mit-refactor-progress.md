# MIT Refactor — Progress Tracker & Resume Point

> **Single entry point** for the MIT tech-debt decomposition. If context was lost, READ THIS FIRST,
> then the linked docs. It tracks exactly which decomposition seams are done, which is next, and the
> landmines that must be preserved — so no one has to re-explore or re-analyze. Last updated 2026-06-10. **S1–S12 on `main` (PR #195).** On the `refactor/mit-seam-s17…` stack (pushed, PR-to-main pending): **S20 + S13 + S16 + S19 + S21 + S17 + S18** — the high-risk async-orchestration core through S18 now landed, each E2E-validated where it touches output (S17/S21/S18 via the production tunnel: Kouchuugun p0 = 2 patches 649×1492+451×1489, byte-identical). A pre-existing `sys.modules` test-pollution bug (test_precision/test_qwen3_translator) was fixed so the **full** suite is a reliable 18 async-only baseline (was masking 8 failures); current totals **18 baseline + 295 passed**.
>
> **Remaining = the high-risk async-orchestration core (tail):** S23/S24/S25/S26a all **code-landed (E2E pending, batched)**. Left: **S26b** `_preprocess_image_for_batch` (the MemoryError pre-process ladder — high-risk, focused pass next), **S22 DispatchRegistry** (deps S4 ✅, #188), and S12 value-object (🔒 #192). S23→S26a landed 2026-06-10 (stage_runner + patch_geometry/patch_renderer + `_run_until_translation_stages` + batch_orchestration; **driver 2235→1934 lines**, 16 new unit cases). Each needs E2E-per-step — the S23→S26a stack E2E is batched into one MIT restart.

> **New latent bug found (preserve for now, fix later behind a flag):** `write_translations`
> (was inline `--save-text`) opens the file with NO `encoding=`, so on a non-UTF-8 default
> platform (Windows cp1252) `ensure_ascii=False` non-ASCII content raises `UnicodeEncodeError`.
> Kept byte-identical in S10; candidate fix = add `encoding="utf-8"` (opt-in/standalone).

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
| **S3** | `ModelUsageTracker` (wrap `_model_usage_timestamps`; **#188 starts**) | stateful | low | ✅ | `model_usage_tracker.py` (branch `…-s3-model-usage-tracker`) |
| **S4** | `ModelUnloader` (routing table; preserve L1) | stateful | med | ✅ | `model_unloader.py` (branch `…-s4-model-unloader`) |
| **S5** | `memory_pressure_guard` (gc/empty_cache/psutil) | stateful | low | ✅ | `memory_guard.py` — `release_memory` only (psutil check single-use, left inline) |
| **S7** | `context_page_counts` (fold accounting) | pure | low | ✅ | `context_counts.py` (only the 2 log-accounting blocks; `_build_prev_context`'s own count is S6) |
| **S8** | `PostDictionaryStage` (fold post-dict) | stateful | low | ✅ | `dictionary.py` (moved load/apply + new `apply_post_dictionary`; re-exported) |
| **S6** | `build_prev_context` pure fn (per-mode index policy explicit) | pure | med | ✅ | `prev_context.py` (thin delegate; L7 first-match preserved) |
| **S9** | `NoneTranslator/GuardPolicy` (front-matter, L3/L12) | stateful | med | ✅ | `none_translator.py` (prep-manual override L12 + none-stamp L3; order preserved) |
| **S10** | `TranslationFileSideChannel` (load/save_text; L2 `exit(-1)`) | stateful | med | ✅ | `translation_store.py` (JSON I/O only; L2 exit + filename left inline) |
| **S11** | `ImageDebugContext` (result_path + MD5 swap) | stateful | med | ✅ | `image_debug_context.py` (full class; helpers→delegates; swap closures→`with_context`) |
| **S12** | `PipelineParams` + `apply_global_settings` (needs #192) | mixed | med | ◐ globals ✅ · value-obj 🔒#192 | `pipeline_params.py` — `apply_global_settings` (`_MODEL_DIR`+TF32) done; `PipelineParams` value-object deferred (entangled w/ device/using_gpu/raise — do after #192) |
| **S20** | `ModelReaper` (TTL loop; opt-in `.stop()`, L14) | async-orch | med | ✅ | `model_reaper.py` (stack; `reap_once`/`start`/`stop`; L13/L14/ttl==0 preserved) |
| **S15** | Stage protocol over 8 `_run_*` (**#187 core begins**) | async-orch | low | ✅ (unit + E2E 2026-06-10) | `stages.py` — 6 leaf adapters (colorizer L15 `**ctx`, upscaling, detection 12-arg+sfx, mask_refinement, inpainting, rendering 3-way). Driver keeps touch instrumentation + delegates. ocr/textline_merge/translation kept inline. 9 cases |
| **S13** | `DetectionPostProcessor` (formalize `_merge_sfx_detections`) | stateful | low | ✅ | `detection_postproc.py` (`merge_sfx_detections`+`textline_aabb`; done w/o S15) |
| **S16** | `TranslationMemory` (the two lists + bleed boundary, L9) | stateful | med | ✅ | `translation_memory.py` (2 lists + `reset()`; 16 sites renamed; append/reset asymmetry preserved) |
| **S21** | `ModelLifecycle` facade + preload (#188 facade) | async-orch | high | ✅ | `model_lifecycle.py` (preload fold ×2 + `ensure_running`/`reaper.ensure_started` fold ×2; wraps reaper — tracker/unloader left direct) |
| **S17** | `TextTranslationDispatcher` (collapse duplicated switch) | async-orch | high | ✅ (unit + E2E 2026-06-10) | `text_translation_dispatcher.py` (`build_chatgpt_translator` + `dispatch_translate`; construction-order + result_path direct/swap + batch_contexts preserved). E2E: Kouchuugun ch1 p1 EN→TH via tunnel, 2 patches 649×1492+451×1489 = baseline exact |
| **S18** | `PostTranslationProcessor` (relocate 4 copies; pin L6/L8 as params) | async-orch | high | ✅ (unit; E2E 2026-06-10) | `post_translation.py` — S18a helper (punct+post-dict+phase1) + S18b/c/d the 3 phase-2 retry loops. **NOT unified**: min_ratio 0.5/0.3, threshold ≥6/>10, collect/reassign (pad+enumerate / filter+text_idx / region_mapping) are load-bearing (L6/L8) → kept as per-scope params. 13 characterization cases |
| **S19** | `gather_per_context` (per-exception placeholder) | async-orch | med | ✅ | `gather_per_context.py` (gather + placeholder; last AFK seam) |
| **S14** | `VerboseDebugSink` (cv2.imwrite/OCR-env/streaming) | stateful | med | ✅ (unit + E2E 2026-06-10) | `debug_sink.py` — S14a six save bodies (guarded/unguarded split pinned) + S14b inpaint-preview pair (unguarded vs guarded = 2 fns) + S14c `ocr_debug_dir_env` ctx-manager. god object down to 1 `cv2.imwrite` (L11 streaming branch, flow control, inline). 15 cases |
| **S23** | `StageRunner` (uniform progress + try/except policy) | async-orch | high | ◐ code ✅ · E2E pending | `f1ce7a3` — `stage_runner.run_stage` + thin `_run_stage`; folded **8** sites in `_translate` + **5** in `_translate_until_translation`. Rendering kept **inline** (it reports `rendering` → conditional `rendering_folder:` BEFORE the run; `_run_stage` couples report+run). until/after method-split **deferred** (preload/save_input_png prefix + image_context suffix + early-exit returns diverge load-bearingly, à la S18). 5 cases |
| **S24** | `PatchRenderer` (extract `_process_group`; share.py:99 contract) | async-orch | med | ◐ code ✅ · E2E pending | **S24a** `2eac7dd` — `patch_geometry.py` (3 self-free numpy fns: `build_local_region`/`create_text_only_mask`/`crop_mask_for_patch`; 8 golden cases). **S24b** `8fa69d3` — `patch_renderer.py` `PatchRenderer.process_group` (the ~90-line closure; `{x,y,w,h,img_png}` + all fallbacks byte-stable; 3 stub-orchestration cases). Driver: 2235→**1999** lines |
| **S22** | `DispatchRegistry` (onto existing `ModelWrapper`; #188 downstream) | stateful | high | ⬜ | S4 |
| **S25** | `PipelineOrchestrator` (drive stage-list; remove dead 'cancel') | async-orch | high | ◐ code ✅ · E2E pending | `dfa0eb1` — `_run_until_translation_stages(ctx,config)->(ctx,finished)`: folds the ~80-line colorize→pre-dict block shared by `_translate` + `_translate_until_translation` (the dup S23 left). early-exit returns `(revert,True)` ⇒ caller `if finished: return ctx` = byte-identical. divergence stays at call sites; **L4 'cancel' preserved** (dead-code removal deferred). Cross-entry stage-list unify **not** done (load-bearing divergence). 3 cases |
| **S26** | `BatchModeOrchestrator` (**last**; MemoryError ladder) | async-orch | high | ◐ S26a ✅ · S26b+E2E pending | **S26a** `70792af` — `batch_orchestration.py` pure helpers: `placeholder_context` (dedup 2 sites) + `build_page_translation_record` (L7 page records; 3 golden cases). **S26b** (MemoryError pre-process ladder → `_preprocess_image_for_batch`) deferred to a focused pass. Driver →**1934** |

## Tech-debt issues (GitHub `Slow-Inc/MangaDock`, label `MIT`)
| Issue | Title | Status |
|---|---|---|
| #186 | `calc_horizontal` → pluggable LineBreaker seam | seam extracted (`_greedy_pack`); #180 wiring pending |
| #187 | MangaTranslator god object → stage orchestrators | in progress (S1+S2 done) |
| #188 | model load/lifecycle + translator base abstractions | started — S3 tracker + S4 unloader done; next #188 seam is S20 ModelReaper (after S5) |
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
