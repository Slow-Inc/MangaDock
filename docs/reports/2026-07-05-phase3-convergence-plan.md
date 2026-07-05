# Phase 3 — Branch convergence plan (landing/render-phase0 → perf → main)

> **Status: PLAN ONLY — not executed.** Touching the 306-file WIP in the main checkout needs the
> developer's sign-off. This document is the reviewable deliverable for validation gate 4.

## The actual situation (measured, not assumed)

Three code streams touch the same MIT render/detection files:

| Stream | Where | State |
|---|---|---|
| **perf tip** `efdf9c3c` | committed on `perf/mit-layout-fit-and-merge` | the base everything shares |
| **landing** `9c9ddf74` (~56 commits) | worktree `mp2-deploy-build`, branch `landing/render-phase0` | the #535 defect-sweep fixes, TDD, based cleanly on the perf tip |
| **WIP** (312 dirty files) | the main checkout, uncommitted on `perf/...` | the developer's stranded render-layout work |

`perf` is 27 ahead / 123 behind `origin/main` (long-diverged — a separate concern, not this plan's job).

## Why this is reconciliation, not a merge or a flag-flip

`landing` is **not** a clean superset of the WIP. Per shared file (line counts perf → WIP → landing):

| File | perf | WIP | landing | Relationship |
|---|---|---|---|---|
| `detection_postproc.py` | 37 | 37 | 227 | **landing-only** — WIP untouched; all #535 completeness nets are landing's |
| `custom_openai.py` / `numbered_contract.py` | — | untouched | **new/fixed** | the index-based parse root-fix is landing-only |
| `manga_translator.py` | 2013 | 2028 | 2048 | landing ahead (source-lang filter, white-box grow) |
| `patch_geometry.py` | 343 | 373 | 431 | landing ahead (guard + erase + changed_alpha) |
| `rendering/__init__.py` | 615 | 817 | 815 | **diverged in content** — similar size, different implementation (WIP +817 vs landing +218 lines vs perf) |
| `render_overlap.py` | 84 | **221** | 130 | **WIP ahead** — has 7 fns landing lacks |
| `text_render.py` | 1256 | 1309 | 1281 | both ahead, overlapping (item-9 port on both sides) |
| `config.py` / `stages.py` | — | +7 / +1 | +4 / +6 | small, both sides |

**WIP-only functions in `render_overlap.py`** (landing deferred slice E): `bubble_fit_bounds`,
`region_territory_box`, `clean_layout_target_fs`, `clean_layout_font_size`, `display_sfx`,
`font_bounds`, `processing_scale`.

So: a blind "take landing" **loses** the WIP's slice-E render functions; a blind "take WIP" **loses**
every #535 detection net + the translation-parse root-fix. Neither side is a superset — hence a
per-file, per-function reconciliation.

## Recommended strategy — 3 stages, lowest-risk first

### Stage A — land the non-conflicting landing work (safe, no WIP contact)
These landing files are **new or additive** and the WIP does not touch them:
- **New files:** `numbered_contract.py`, `region_filter.py` additions, all new test files, `eval/render_defects.py`.
- **WIP-untouched files landing owns:** `detection_postproc.py` (WIP == perf here), `custom_openai.py`,
  `common_gpt.py`, `config_gpt.py`, `text_layer.py`, `sfx_merge.py`.
- **Action:** cherry-pick / merge these onto perf directly. Zero WIP conflict. Ships the detection
  completeness nets + the parse root-fix + the SFX/dedup/source-lang fixes immediately.

### Stage B — reconcile the 8 shared files WITH the developer, one function at a time
For `rendering/__init__.py`, `render_overlap.py`, `patch_geometry.py`, `manga_translator.py`,
`text_render.py`, `stages.py`, `config.py`:
- Treat the **WIP as authoritative for the render-layout functions it is ahead on** (slice E:
  `bubble_fit_bounds`, `region_territory_box`, etc.) — landing deliberately didn't port those.
- Treat **landing as authoritative for the #535 additions** (guard, `changed_alpha`,
  `add_own_balloon_interiors`, `erase_own_balloon_ink`, white-box grow, page_shape, telemetry).
- `rendering/__init__.py` is the hard one (diverged content): merge by **hunk**, guided by the test
  suites on both sides — landing's `test_render_telemetry.py` + WIP's equivalents must both stay green.
- **Do NOT bulk-stage the 312 WIP files.** Reconcile only the 8, leave the rest of the WIP as the
  developer left it.

### Stage C — the perf ↔ main divergence (separate, deferred)
123-commit main-lead vs 27-commit perf-lead is a pre-existing divergence unrelated to the render
sweep. Out of scope here; do it as its own reconciliation after the render streams converge.

## Pre-flight gates (all must pass before Stage B executes)
1. ✅ Regression sweep clean (One-Punch p1/p2 EN+THA) — `61824c9f`.
2. ✅ Full-page-inpaint path verified — `919c89fd`.
3. ⛔ **Gal Yome EN→TH** (2nd-manga, benchmark rule) — needs the Reader tunnel; developer-gated.
4. ⛔ Developer sign-off on touching the WIP files (Stage B).

## The one-line ask for the developer
> Stage A can ship now with zero risk to your WIP. Stage B needs you — either (a) commit your WIP
> first so I can do a real 3-way merge with conflict markers, or (b) point me at which of the 8
> shared files your WIP is the source of truth for, and I reconcile function-by-function.
