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

Quality/perf/rendering state carried by this branch: noise-adjusted **1.55/2 strict** (range 1.55-1.68; 367 segments, 58.9 % perfect strict), gate
covering every class with 0 violations on the corpus dashboard, 9 natural guard saves with **0 leftovers** on the 39-page
sweep, render telemetry all-zero across 39 pages, serial default filter-before-translation (+1.5 s/page on mixed pages),
and the measured opt-in levers (batch 1.46x with payload parity, preload, widen columns, segment retry).
## Merge-conflict forecast against current `main` (2026-10-23)

`git merge-tree --write-tree --name-only origin/main HEAD` (read-only dry-run):

- **Code merges cleanly** — no conflicts in `MIT/`, `Backend/` or `Frontend/`.
- Conflicts are limited to three append-heavy **docs** files: `DONE.md`, `docs/adr/README.md`,
  `docs/reports/system-impact-report.md` (all take-both / ordering fixes).

Delivery note: #794 is based on `integrate/render-reconcile` (#642, still an open draft). Retarget #794 to `main`
**after** #642 merges (or before it if the base branch is about to be deleted); at that point only the three docs
conflicts need resolving — the code is conflict-free.
## Merge simulation into current `main` (2026-10-23, temp worktree)

Executed a real merge in a throwaway worktree (`origin/main` + this branch head `6e3b39ae`):

- Conflicts were **exactly** the forecasted three docs files; every code path auto-merged.
- Resolved the docs by keeping main's side (for the simulation only) and committed the merge.
- **Fast suite on the merged tree: 944 passed, 4 skipped** — no code adjustment is needed after the base lands.
- Temp worktree removed afterwards; the real resolution should **union** the docs (DONE entries from both sides,
  ADR README rows, system-impact rows), not keep one side.

Conclusion: once #642 lands and this PR is retargeted to `main`, only the three docs append conflicts need a union
merge; the merged code is green.