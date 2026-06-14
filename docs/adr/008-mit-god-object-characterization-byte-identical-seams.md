# ADR 008 — MIT god-object decomposition via characterization-first, byte-identical seams (S1–S26)

- **Status:** Accepted (2026-06-14) — **implemented.** All 26 seams (S1–S26) of the `#187`/`#188`
  decomposition have landed (S12 `PipelineParams` value-object was the last, 2026-06-11, closing
  `#187`). The *method* is binding for every future change to the MIT core. Two follow-on items
  remain explicitly **out of scope** of this decision and are *not* implemented: the `#188`
  translator `BaseGPTTranslator` base-abstraction half, and the full centralized-config `#192`
  (only the `parse_and_validate_config` parse seam was taken; `load_dotenv` extraction deferred).
- **Area:** MIT / Architecture
- **Context docs:** `docs/reports/mit-refactor-progress.md` (seam status + 16 landmines) ·
  `MIT/PIPELINE.md §5` (per-module delta) · `docs/reports/system-impact-report.md` (before→after) ·
  `.claude/memory/feedback_decomposition_method.md` (the standing rule)

## Context

`MIT/manga_translator/manga_translator.py` is the **hottest path in the product** — every
translated page flows through the `MangaTranslator` driver. It had grown into a ~3040-line
god object that mixed config parsing, model load/lifecycle/TTL, the async stage pipeline,
cross-page translation memory, post-translation retry loops, debug-image side-channels, and the
per-patch render path. A silent behaviour change anywhere in it breaks translation **system-wide**
and is hard to detect, because the leaf logic was only reachable through a full `MangaTranslator`
instance plus the ~22s ML stack — so almost none of it was unit-tested.

Forces:

- The driver had to keep shipping correct pages throughout the refactor (no freeze window).
- Many of its quirks are **load-bearing**, not accidents: per-mode divergences whose "obvious
  cleanup" would silently change output. The progress tracker enumerates **16 landmines** to
  preserve verbatim (e.g. **L6** divergent validation — `min_ratio` 0.5 single/batch vs 0.3
  concurrent, region threshold ≥6 single/concurrent vs >10 batch; **L7** context-window asymmetry;
  **L9** singleton page-context bleed `#136`/`#140`; **L2** `exit(-1)` in a stage; **L10** `zip()`
  truncation; the cp1252 `write_translations` encode bug). Mixing "move code" with "fix behaviour"
  would let a regression hide inside a refactor commit.
- A future maintainer (human or agent) needs the carved-out logic to be testable in isolation so the
  *next* change is safe — testability, not line count, is the goal.

## Decision

Decompose the god object by **characterization-first, byte-identical extraction, one seam per
commit**, repeated across **26 seams S1–S26** (plus pre-seams `#192a`/`#192b`/`#186`). The
discipline, which is now **binding for any future core refactor**:

1. **Characterization net first.** Write tests that lock the *current* behaviour of the target
   logic before touching it; only then extract.
2. **Byte-identical extraction.** The moved code must be verbatim — proven by `git diff -w` review
   against the characterization net, and by **pixel-exact E2E** through the production tunnel for
   any seam that touches output (the recurring fixture: Kouchuugun ch1 p0, 2 patches `649×1492` +
   `451×1489`, byte-exact to baseline).
3. **One seam per commit** → independently reviewable, rollback = a single revert, blast radius =
   one seam.
4. **Landmines preserved verbatim, fixed only later behind opt-in flags / per-scope params.** Where
   "N copies" are structurally divergent *on purpose* (the S18 finding: pad+enumerate vs
   filter+text_idx vs cross-context region_mapping), they are relocated and the divergence pinned as
   explicit per-scope params rather than force-merged.
5. **New code attaches at a seam with tests — never grow the monolith.**

The driver now **delegates** to ~21–22 small, dependency-light, unit-tested modules carved out
this way. Verified in the live tree (`MIT/manga_translator/`):

- **Imports at the top of `manga_translator.py`** pull from the extracted modules
  (`manga_translator.py:17–64`): `region_filter`, `region_apply`, `model_usage_tracker`,
  `model_unloader`, `memory_guard`, `context_counts`, `dictionary`, `prev_context`,
  `none_translator`, `translation_store`, `image_debug_context`, `pipeline_params`, `model_reaper`,
  `detection_postproc`, `translation_memory`, `gather_per_context`, `model_lifecycle`,
  `text_translation_dispatcher`, `punctuation`, `stage_runner`, `patch_geometry`, `patch_renderer`,
  `batch_orchestration`, `stages`, `debug_sink`, `post_translation`.
- **Pure / value modules** (no ML imports, unit-test in <1s): `translator_chain.py`
  (`parse_translator_chain` — the pure parse function `config.py`'s `class TranslatorChain` now
  delegates to, `#192a`), `pipeline_params.py` (`class PipelineParams.from_params`,
  S12 — `parse_init_params` at `manga_translator.py:308–324` now delegates to it byte-identically),
  `patch_geometry.py` (`union_refined_with_fallback` + crop/mask geometry, S24a),
  `translation_memory.py` (`class TranslationMemory`, the two cross-page lists + `reset`, S16).
- **Stateful / async-orchestration modules** (self-bound deps passed as callbacks):
  `dispatch_registry.py` (`class DispatchRegistry`, S22 — folds the get/cache/unload trio across all
  6 dispatch modules and killed the global `MODEL` in detection), `model_lifecycle.py`
  (`class ModelLifecycle`, S21 facade), `patch_renderer.py` (`class PatchRenderer.process_group`,
  S24b).
- **Config-parse seam.** `config.py:464 parse_and_validate_config(config) -> Config` (`#192`) is the
  single Pydantic-v2 parse/validate seam every endpoint shares, replacing scattered
  `Config.parse_raw` calls.

**Live line-count reconciliation (per the special instruction).** Reader reports disagree
(1934 vs 2235 vs "3040→"). The **actual** current driver is **1984 lines**
(`wc -l manga_translator/manga_translator.py`). The real delta from the pre-decomposition baseline
(`73251c5`) is **3040 → 1984 = −1056 (−34.7%)**. The discrepancy is dated snapshots, not error:
`feedback_decomposition_method.md` and `system-impact-report.md` record the 2026-06-10 snapshot
**3040 → 2235 (−805, −26.5%)**, *before* the tail seams S23–S26; `mit-refactor-progress.md` then
records S23→S26a taking the driver **2235 → 1934**, and the S24b note records **2235 → 1999**.
The live `1984` post-dates all of these. The mismatch is **documentation drift** that should be
reconciled to the live number.

## Alternatives considered

| Option | Verdict |
|---|---|
| **Big-bang "Phase-C" rewrite** of the driver into orchestrators in one pass | **Rejected** — risky drift on the product's hottest path; a silent behaviour change would break translation system-wide and be hard to catch. The `tech-debt-remediation-plan.md` 2026-06-09 reconciliation explicitly chose the seam-based, interleaved path over monolithic Phase-C. |
| **Tidy the landmines during extraction** (fix L2 `exit(-1)`, the cp1252 encode bug, unify the L6 0.5/0.3 + ≥6/>10 thresholds, merge the divergent retry loops) | **Rejected** — couples a refactor with a behaviour change so neither hides in the other. Landmines are preserved verbatim and only fixed later behind opt-in flags. |
| **Monolithic value-object extraction up front** (pull a big params/state object first, then split) | **Rejected** — high churn for little safety; the value-object (`PipelineParams`, S12) was taken *last*, as a small byte-identical seam once the surrounding code was already carved. |
| **Full centralized config `#192`** (single config object, `load_dotenv` extraction, kill all bare-excepts) | **Deferred** — only the `parse_and_validate_config` parse seam was taken. `load_dotenv` extraction's import-order risk outweighed its ROI; remaining bare-excepts are intentional broad catches. |

## Consequences

**Positive**
- **Testability is the durable win.** Leaf logic (e.g. the 12-positional-arg `dispatch_detection`
  call) that previously needed a full instance + the 22s ML stack now unit-tests in <1s by stubbing.
  MIT test cases rose **180 → 319 (+77%)** as the characterization net (snapshot 2026-06-10; tail
  seams added more — e.g. the suite reached 365 at S12).
- **Zero behaviour change, proven.** 4 consecutive byte-identical E2E runs (the 2-patch fixture)
  across the stack; each output-touching seam re-validated through the production tunnel.
- **Small blast radius / easy rollback** — one commit per seam, single-revert rollback.
- **New features attach at seams**, not the monolith — render-parity knobs (`#168`/`#173`/`#179`/
  `#248`/`#249`/`#250`) and `full_page_inpaint` plug into `patch_renderer`/`patch_geometry`
  rather than growing the driver.

**Negative / limits**
- **16 preserved landmines are deliberate debt.** They are *intentionally* kept verbatim (now pinned
  as per-scope params), so the divergence is documented rather than removed; the fix path is
  "behind an opt-in flag, never silently". Until then the quirks remain live (e.g. the cp1252
  `write_translations` `UnicodeEncodeError`, the L1 TTL key-drift that never unloads
  `colorizer`/`textline_merge`/`rendering`).
- **Revert hazard is uniform across the new modules:** re-syncing `manga_translator.py` from
  upstream would drop the delegation imports (`ImportError`) and the extracted logic + its preserved
  landmines would vanish — the decomposition is now a hard dependency, not optional.
- **A few seams are no longer byte-identical with upstream by design** — the S24 patch-render path
  carries intentional `#248`/`#173`/`#249`/`#250` divergences layered on top of the byte-identical
  extraction.

**Follow-ups**
- **Reconcile the line-count drift** in the docs to the live `1984` (3040 → 1984, −34.7%).
- **Fix the preserved landmines behind opt-in flags** when each is prioritised (cp1252 encode,
  L1 TTL key-drift, the L6 threshold unification, etc.).
- **Finish `#188`** — the translator `BaseGPTTranslator` base-abstraction half is still open.
- **Finish `#192`** — `load_dotenv` / fuller config centralization remains deferred.
