# MIT Tech-Debt Remediation Plan

> Ordered roadmap for paying down the MIT tech-debt backlog (issues #186–#193) **before** building
> new features, to cut compounding errors. Derived from the 2026-06-09 4-agent audit
> (`docs/research/` + the issues). Principle: **foundation → render → biggest-last, incremental,
> ship/validate between steps — never big-bang.**

## Why this order (anti-compounding)
The thing that makes a codebase "become like LINE" is **features bolted onto the core until debt
multiplies**. In MIT the core is the `MangaTranslator` orchestrator (#187) + the missing model/translator
abstractions (#188) — that is where every new feature compounds. So **core decomposition (#188 → #187) is
the objective**; the foundation + peripheral items are the *means* (the scaffolding + safety nets that let
us decompose the core without breaking it), not an end to chase exhaustively. Don't nibble peripheral
slices forever — finish enough foundation to make the core safe, then decompose the core. See the
`feedback_core_boundary` rule: **new features attach at a seam with tests, never grow the monolith.**

## Reconciled plan (2026-06-09 deep analysis — supersedes the phase ordering below)

A 6-agent deep read produced `docs/research/mit-core-decomposition-analysis.md` — the verified
decomposition map (26 seams S1–S26, dependencies, per-seam test strategy, and 16 source-cited
landmines). It reconciles this roadmap:

- **Strategic spine holds**: anti-compounding, the four Iron Rules, `#188 before #187` *facade* work,
  ship/validate between increments.
- **Tactical correction**: `#187` and `#188` are **not** monolithic Phase-C items — they are ~16
  independently-shippable seams, several already landed out of order and correctly (the validator checks
  `translation_checks.py`, `punctuation.py`, and the `_greedy_pack` line-break seam #186 are all S-seams).
  **Split them into seams and interleave the low-risk ones into Phase A**; start #188's tracker/unloader
  (S3/S4) early; keep the high-risk facade (S17, S18, S22–S26) last.
- **Highest-value/lowest-risk dedup the plan missed**: the **four-way post-translation duplication** —
  `should_filter` is *verbatim*-identical at 1287-1314 ≡ 2372-2401 ≡ 2542-2571. It is **step 1**.
- **Landmines to PRESERVE (not "fix") during extraction**, then fix separately behind an opt-in flag:
  TTL key drift (`'colorizer'` never matches `case 'colorization'`, L1), divergent validation
  (`min_ratio` 0.3 vs 0.5, region threshold 6 vs >10 — *load-bearing*, L6), singleton page-context bleed
  (`reset_page_context` only from `translate_patches`, L9), `exit(-1)` in a stage (L2), cleanup-task leak (L14).

**Corrected next 3 steps** (from the analysis):
1. **S1 `filter_translated_regions(regions, config)`** — extract the verbatim 3-way `should_filter` block;
   gate = all three inline copies + the new fn yield identical kept-set + identical `Filtered out`/`Reason` logs.
2. **S2 `apply_translations` / `apply_original_as_translation`** — fold the 4 happy-path copies + casing;
   gate = byte-identical region attributes incl. `zip`-truncation (L10) and upper/lower.
3. **S3 `ModelUsageTracker`** *(starts #188 here, not Phase C)* — wrap `_model_usage_timestamps`; gate =
   golden the exact `(tool, model)` key tuples (documents the L1 drift as a pinned invariant before S4).

The phase tables below remain as the strategic reference; execution follows the seam order in the analysis doc.

## Iron rules (apply to every item)
1. **Characterization net first.** For any core/shared module, capture golden behaviour across *all*
   imaginable scenarios before touching code, then prove byte-identical (`feedback_techdebt_all_scenarios`).
2. **Report on close.** Closing an issue / opening a PR → write the report (`feedback_impact_report`):
   bug → post-mortem template; refactor → full-field change record; both into `system-impact-report.md`.
3. **Ship + validate between increments.** Small commits, tests green each step. No stacked unvalidated refactors.
4. **Never close/merge without the user's explicit confirmation.**

## Order

### Phase A — Foundation (low risk, makes everything else safer)
1. **#192 — config centralize + cleanup** *(do first)*
   - Why first: removing the `load_dotenv` import side-effect + extracting `TranslatorChain` parsing into a
     pure testable module raises testability for the *whole* codebase, de-risking every later refactor.
   - Slices: (a) extract+unit-test `TranslatorChain` parsing (pure); (b) remove dead fields
     (`_batch_contexts`/`_batch_configs`) + bare-`except` cleanup; (c) move `load_dotenv()` out of import
     into explicit init at entry points (carefully — worker `HF_TOKEN` auto-download depends on it);
     (d) single `parse_and_validate_config` for server endpoints; lazy env reads.
2. **#193 — worker `--start-instance` lifecycle**
   - Why: cheap; removes the daily restart friction (5003 kill orphans 5004) we hit every dev cycle.
   - Slices: testable `port_in_use(port)` + PID tracking helper; graceful shutdown kills the worker;
     loud failure on port collision; README documents the two-port restart.
3. **#186 — finish the line-break seam** (greedy `_greedy_pack` already extracted)
   - Formalize a `LineBreaker` contract + make the greedy/KP choice explicit; update `PIPELINE.md §5`.
   - Naturally folds into **#180 step 2** (wire Knuth-Plass packer of the same signature behind a knob + E2E).

### Phase B — Investigate + render (medium risk, characterization-net protected)
4. **#191 — vendored LDM / YOLOv5**: *investigate first.* Confirm whether SD/LDM inpaint is still used
   (dev pipeline uses `lama_large`). If dead → delete the module (~3000 LOC, big low-risk win). If live →
   move inference to `diffusers` + license audit. Same for the YOLOv5 ComicTextDetector.
5. **#189 — glyph-render dedup** (`put_char_horizontal/vertical` + stroke): pixel-golden characterization
   net (render → numpy array) then extract direction-parameterized helpers + a `FontStack`.
6. **#190 — render geometry decompose** (`resize_regions_to_font_size` + box-padding + constants): reuse
   the render characterization pattern.

### Phase C — Biggest, last
7. **#188 — model load/lifecycle + translator base abstractions**: needs a test strategy for the ML stack
   (contract tests, not full models). Kills global `MODEL` state + per-impl boilerplate.
8. **#187 — `MangaTranslator` god object** *(last)*: benefits from #188/#192 being done first. Decompose
   incrementally (one stage orchestrator at a time, golden-page byte-identical each step), not in one PR.

## Status
- **#186**: seam extracted (`_greedy_pack`), 16-case net — *partly done*.
- #187–#193: open. This plan executes them in the order above.
- Live progress: `DONE.md` (dev log) + `docs/reports/system-impact-report.md` (report-level).
