# MIT quality loop - branch hand-off index (2026-10-23)

One page for whoever picks this branch up next. The detailed evidence lives in the linked benchmark reports; this page
names the state, the knobs and the things that were already tried and rejected (so nobody repeats them).

## State

| item | value |
|---|---|
| branch / PR | `feat/mit-quality-loop`, PR #794 (draft, base `integrate/render-reconcile`, MERGEABLE) |
| end-state sweep | latest full runs **v7-v10**: 39 pages / 369-371 regions, page gate `{}`, leftover `{}` in every run; guard triggers 1-14 depending on the model window; wall 6.1-10.3 s avg (retry-bound in bad windows) |
| judge | raw **1.38-1.44/2** (window-dependent); strict-adjusted **1.53-1.60**; broken share **2.2-2.4 %** |
| tests | **995 passed**, 4 skipped (fast suite, torch-free stub) |
| CI | logic gate / heavy ML / backend green; Vercel green on several heads (`16ff6e43`, `3d1f6d94`, `bc773045`) when its build quota allows |
| merge readiness | `merge-tree` diff vs main: only the three append-only docs conflict; merged tree fast suite 993 at the last re-verify (branch 995 after the round-274 licences) |

## Defaults that were turned ON in this loop (quality first)

- `MIT_OCR_REREAD` (second OCR pass; low-confidence Latin lines, single-letter garbles like `N`->`NOT` with a wider crop, never garbled-to-garbled)
- `MIT_FILTER_AFTER_STRIP` (early filter before translation)
- `normalize_common_typos` (Thai แล่ว/แลว, ไม/ให้ tokens, name whitelist for Mai)
- guards: foreign-script (22 scripts) + leaked-script salvage, negation_lost, runaway, spurious_filler, lost_as_rare,
  dropped_question (with tag / retort licences), untranslated_word, content_loss, consider_as_please, numbered contract,
  series name memory (interjections excluded)
- gate/guard precision licences: retort questions, opinion tags (`SEE?`, `UNDERSTAND?`), Thai emphasis particles and question particles carrying `!`, reader-site URLs/credits, digit-suffixed kept names, strong Thai negation
- latency: concurrent SFX vision prefetch (order-preserving, empty answers cached) + 768 px JPEG uploads

## Opt-ins (real tradeoffs, so not default)

`MIT_BATCH_PIPELINE`, `MIT_PRELOAD`, `MIT_SEGMENT_RETRY`, `MIT_CONTEXT_PAGES`, `MIT_TEMPERATURE`,
`MIT_OMISSION_VERIFY` (+`MIT_OMISSION_VERIFY_PASSES`), render knobs, debug logs (`MIT_LOG_GLITCH`, `MIT_LOG_OCR_REREAD`,
`MIT_LOG_OMISSION_VERIFY`, `MIT_LOG_REGION_FILTER`, `MIT_SERIES_GLOSSARY_LOG`).

## Evidence index (docs/reports/benchmarks/2026-10-23-*.md)

| file | what it answers |
|---|---|
| `final-quality-baseline.md` | every sweep v1-v7, gate/leftover/guard numbers, judge runs, leftover definition |
| `quality-loop-final-report.md` | the end-to-end story and numbers |
| `ocr-reread-pass.md`, `ocr-reread-prod-acceptance.md`, `ocr-single-letter-garble.md` | OCR second pass, its A/B and the garble fix |
| `omission-verify-integration.md` | opt-in omission verifier: three bugs found, replay proof, cost |
| `guard-precision-licences.md` | retort + Thai emphasis licences, retry-budget decision |
| `prod-path-acceptance.md` | production single-page path + series memory verification |
| `premerge-verification.md` | merge simulation, runbook, re-verification vs main |
| `sfx-vlm-prefetch.md` | textline_merge 32-37 s -> 8.4 s via concurrent SFX vision calls + smaller uploads |
| `new-manga-generalization.md` | 27 unseen pages across 5 series (26 gated clean) |
| `guard-precision-licences.md` | every precision licence and the retry-budget decisions |
| `next-loop-backlog.md` | **do-not-repeat list** (rejected experiments with evidence) |

## Open items

1. Wait for #642 to land, then run the merge-day runbook in `premerge-verification.md` (retarget to main, union the three
   docs conflicts, confirm CI, close the loop issues listed there).
2. Vercel build quota window (external): re-check `gh pr checks 794` after it clears; the docs-function fix is verified.
3. Optional next campaign (needs a decision, not more tuning): the remaining zero-score segments are model-sense errors
   (`private ones` -> private days off, `killed` -> guess, `drain` -> hoard) that no deterministic guard catches today.
## By the numbers (branch vs `integrate/render-reconcile`)

| metric | value |
|---|---|
| commits | **450** |
| files changed | **318** (+19,212 / -295) |
| of which MIT | 131 files |
| of which docs/reports | 174 files |
| fast test suite | **997 passed**, 4 skipped |
| unseen-page validation | 6 series / 31 pages, 30/31 gated clean |
| sweeps recorded | v1-v11 (all with page gate `{}` after re-scan) |
| judge runs | raw 1.38-1.44, adjusted 1.53-1.60, broken 2.2-2.4 % |
| CI | logic gate / heavy ML / backend green; Vercel green on several heads |