# MIT quality loop — consolidated status (2026-10-23)

Scope: quality-first loop on the real manga corpus (`MIT/result/{corpus,corpus2,corpus3}`, 39 pages), GPU1 RTX 5060 Ti.
Branch `feat/mit-quality-loop` (PR #794, draft), base `integrate/render-reconcile`.

## 1. Quality baseline (judge audit, all pages)

| batch | pages | segments | mean | 0/1/2 |
|---|---|---|---|---|
| audit82 | 6 | 71 | 1.37 | 2/41/28 |
| fresh22 | 8 | 53 | 1.43 | 3/24/26 |
| fresh23 | 8 | 67 | 1.58 | 0/28/39 |
| f24+g21 | 18 | 178 | 1.42 | 6/91/81 |
| f24b | 3 | 33 | 1.36 | 0/21/12 |
| Kaoru p1 (manual) | 1 | 1 | 2.00 | — |
| **total** | **39/39** | **403** | **1.44** | **11/205/187 (broken 2.7 %)** |

Judge noise caveat: the raw mean is depressed by the judge's typo noise (it repeatedly reports identical strings as
misspelled); meaning-level flags were triaged manually in every batch.

## 2. Shipped quality fixes (default on unless stated)

| change | evidence |
|---|---|
| deterministic **quality gate** (`tools/quality_gate.py`) + `doctor_page --gate/--gate-only` | catches the historically shipped Cyrillic/name defects; 0 hard violations on all fresh pages |
| **contract guard**: a split/merged numbered block is re-asked before it shifts every balloon (#1026) | mocked split answer re-asked once; live rerun aligned |
| **num/word guards**: runaway repetition (#901), foreign-script retry + leaked-script **salvage** (#903), Thai filler words (#1039), LOST->หายาก (#1052), negation re-ask (#898) | 182/182 stored leaks script-clean after salvage; mocked retries verified; live guard hits all true positives |
| guards are real **retry triggers** (fixed a wiring bug where two were notes-only) | direct trigger regression test; 3 `foreign_script` + 2 `spurious_filler` live hits, 0 false positives over 26 pages |
| **name glossary** for the batch path (#980): romaji names + JP katakana, two-occurrence filter, deterministic enforcement | TSUKUYOMI inconsistent -> consistent across a chapter pair; extraction precision pass (junk entries removed) |
| **claim/Thai fixes**: number tokens never split by line wrapping (#842), `นาทีละ` tie verified (#844), OCR-punctuation and Thai question-marker gate refinements | 47 Thai-wrap tests + gate tests |
| **segment retry** opt-in default off (#1055) | forced harness: 6.8 s -> 5.2 s per glitched page but isolated retries garbled/truncated in the sample -> kept opt-in |

## 3. Opt-ins (with the tradeoff that blocked default)

| flag | what it does | tradeoff / status |
|---|---|---|
| `MIT_BATCH_PIPELINE=1` | cross-page pipelining + context + glossary | no live per-page progress, higher peak memory; in-process 1.37x, worker HTTP 1.16x loaded |
| `MIT_CONTEXT_PAGES` | rolling dialogue context | mixed A/B (helped one page, hurt another) -> stays 0 |
| `MIT_PRELOAD=1` | model preload at worker boot | first page 21.5 s -> 18.1 s e2e; holds GPU/RAM while idle, slower boot |
| `render.widen_vertical_columns` (#1006) | wider block for JP vertical sources | +20-42 % font on the worst JP regions, EN byte-identical; block may exceed the source column |
| `render.fit_below_floor` (#883) | shrink below the font floor instead of overlapping | small text vs overlap; opt-in by design |
| `translator.concise_bubbles` (#892) | shorter Thai lines | A/B tie on the corpus; narrow-bubble subset judge 8-3 but noisy |
| `MIT_SEGMENT_RETRY=1` (#1055) | retry only flagged segments | 20-25 % faster glitched page, quality risk from lost page context |
| `MIT_NAME_GLOSSARY=0` | disables the cross-page glossary | default on for the batch path only (single-page path has no cross-page state) |

## 4. Performance profile (8 pages)

wall **8.98 s** avg (warm 3.6-7.9 s) · translation **1.91 s** · mask+inpaint **0.70 s** · OCR ~1.4 s · detection
0.5 s warm / 5-6 s cold · rendering 0.1-1.9 s. Remaining scoped lever: overlap mask+inpaint with the translation
wait (up to 0.7 s/page) — blocked on the region-list invariance documented in #1050/#1051.

## 5. Open items

- #1050/#1051: mask+inpaint overlap blocked on moving the source-language filter before translation (needs an A/B;
  an early-filter experiment was tried twice and reverted — it changed output on a page with kept non-Latin SFX).
- #897: JP→TH evaluation limited by data — the repo has **one** real JP page (uploaded twice).
- #1047 preload: e2e proven; opt-in kept (idle GPU/RAM cost).
- #1052/#1039: live confirmation of a natural retry is intermittent; mocked + guard hits cover the mechanism.
- #899 (grey outlined lettering): **closed as not reproducible at HEAD** — current render is black-fill/white-halo
  and readable; a background-aware safety net measured byte-identical (nothing to fix).

## 6. Reusable tooling added

`tools/quality_gate.py` (chapter gate), `tools/name_consistency.py`, `tools/stability_audit.py`,
`tools/forced_glitch_retry_bench.py`, `tools/judge_translations.py` (pre-existing), and `doctor_page.py --gate
--gate-only --no-png`.