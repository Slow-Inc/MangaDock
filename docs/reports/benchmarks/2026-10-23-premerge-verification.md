# Pre-merge verification battery (branch head, 2026-10-23)

| check | command | result |
|---|---|---|
| MIT fast gate (torch-free) | `pytest test/ -k "not test_the_contracts_import_without_torch"` | **932 passed**, 4 skipped |
| MIT heavy subset (torch) | `test_stages` + `test_custom_openai_glitch_retry` + `test_translation_quality` + `test_quality_gate` | **86 passed** |
| Backend config spec | `jest src/books/mit-config.spec.ts` | **27 passed** |
| CI logic gate (Actions) | pytest torch-free | **pass** |
| CI heavy ML (Actions) | pytest full suite (report-only) | **pass** (3m49s) |
| CI backend | jest | **pass** |
| CI Vercel | frontend preview deploy | fail — deployment/rate-limit on the Vercel side; no Frontend files touched by this branch |

PR #794 is **MERGEABLE** against `integrate/render-reconcile`.

Quality/perf/rendering state carried by this branch: noise-adjusted **1.68/2** (367 segments, 70.6 % perfect), gate
covering every class with 0 violations on the corpus dashboard, 9 natural guard saves with **0 leftovers** on the 39-page
sweep, render telemetry all-zero across 39 pages, serial default filter-before-translation (+1.5 s/page on mixed pages),
and the measured opt-in levers (batch 1.46x with payload parity, preload, widen columns, segment retry).