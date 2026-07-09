# #608 — restore Stage C wiring + #278 SFX gate clobbered by #553

**Date:** 2026-07-09 · **Type:** code-regression restore (pipeline re-wire; no new render logic)

![Stage C wiring restore — call-graph before→after + RED→GREEN](./2026-07-09-608-stage-c-rewire.png)

## Method

Deterministic, torch-free — the change is a **pure un-revert** of call sites, so the meaningful measurement is the driver's **call graph**, not a stochastic render. `test/test_stage_c_wiring.py` parses `manga_translator.py` with `ast` and asserts the driver actually **calls** the Stage C mask-quality stack (`assemble_fullpage_erase_mask`, `protect_figure_ink`, `adaptive_dilate_mask`, `flatten_white_captions`) and the #278 SFX provenance gate (`should_rescue_sfx` / `from_sfx_detection`). This runs in the logic gate and closes the blind spot that let #553 revert the wiring invisibly (helper unit tests + the fake-driver render test all kept passing).

## Before → After

| | clobbered main (#553) | restored (#608) |
|---|---|---|
| Stage C mask-quality calls in driver | ❌ none (reverted to `union_refined_with_fallback`) | ✅ all 4 called |
| #278 SFX gate | ❌ pre-#278 `len<=4` heuristic | ✅ provenance gate called |
| `test_stage_c_wiring.py` | ❌ 2 failed (RED) | ✅ 2 passed (GREEN) |
| MIT logic suite | 459 pass / 1 pre-existing collection error | 459 pass / same pre-existing |
| driver diff vs pre-clobber `dc777f19` | −129/+27 | 0 (identical — pure un-revert) |

## Assessment

- **fix-root:** yes — restores the exact call sites #553's stale base removed; verified the un-revert is byte-identical to `dc777f19` (the file was touched only by the clobber since then) and that all 7 imported symbols still exist on main, so it imports cleanly.
- **no-regression:** additive; #553's legitimate additions (img-cache, llm.service, plans) are untouched; docs restore is a superset (no current main entry lost).
- **render quality:** the render *effect* of Stage C (narration fit / figure protection / white-caption flatten) was already benchmarked at merge time — `docs/reports/benchmarks/2026-07-06-548-*`. This PR only re-connects that verified behaviour; a fresh GPU render A/B can re-confirm on request (needs the worker up; translate is non-deterministic so use the offline replay harness).
- **limitation:** the AST wiring test proves the calls exist in the driver, not that a full GPU render produces the exact pixels — that ties back to the #550 benchmark.
