# MIT quality loop - branch hand-off index (2026-10-23)

One page for whoever picks this branch up next. The detailed evidence lives in the linked benchmark reports; this page
names the state, the knobs and the things that were already tried and rejected (so nobody repeats them).

## State

| item | value |
|---|---|
| branch / PR | `feat/mit-quality-loop`, PR #794 (draft, base `integrate/render-reconcile`, MERGEABLE) |
| end-state sweep | **v7**: 39 pages / 369 regions, page gate `{}`, leftover `{}`, 3 guard triggers (all true positives), wall 7.83 s avg / 6.62 s median |
| judge | raw **1.42-1.44/2** across runs; strict-adjusted **1.53-1.60**; broken share **2.2 %** (best) |
| tests | **985 passed**, 4 skipped (fast suite, torch-free stub) |
| CI | logic gate / heavy ML / backend green; Vercel green on `16ff6e43`, later heads blocked by its external build-rate limit |
| merge readiness | `merge-tree` diff vs main: only the three append-only docs conflict; merged tree fast suite 985 |

## Defaults that were turned ON in this loop (quality first)

- `MIT_OCR_REREAD` (second OCR pass; low-confidence Latin lines + single-letter garbles + wider crop for those)
- `MIT_FILTER_AFTER_STRIP` (early filter before translation)
- `normalize_common_typos` (Thai แล่ว/แลว, ไม/ให้ tokens, name whitelist for Mai)
- guards: foreign-script (22 scripts) + leaked-script salvage, negation_lost, runaway, spurious_filler, lost_as_rare,
  dropped_question (with tag / retort licences), untranslated_word, content_loss, consider_as_please, numbered contract,
  series name memory (interjections excluded)
- gate precision licences: retort question, Thai emphasis particle carrying `!`

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
| `next-loop-backlog.md` | **do-not-repeat list** (rejected experiments with evidence) |

## Open items

1. Wait for #642 to land, then run the merge-day runbook in `premerge-verification.md` (retarget to main, union the three
   docs conflicts, confirm CI, close the loop issues listed there).
2. Vercel build quota window (external): re-check `gh pr checks 794` after it clears; the docs-function fix is verified.
3. Optional next campaign (needs a decision, not more tuning): the remaining zero-score segments are model-sense errors
   (`private ones` -> private days off, `killed` -> guess, `drain` -> hoard) that no deterministic guard catches today.