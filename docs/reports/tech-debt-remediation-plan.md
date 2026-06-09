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
