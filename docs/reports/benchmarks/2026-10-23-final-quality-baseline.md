# Final quality baseline (39-page config end state): **raw 1.44/2, noise-adjusted 1.55-1.68/2** (classifier-dependent)

- **Date:** 2026-10-23 · judge over the **final 39-page sweep outputs** (`final56`, the exact end-state defaults),
  real gateway, chunked judge; noise classified with `tools/audit_summary.py`.

## Numbers

| metric | value |
|---|---|
| pages judged | 38 (one page produced no scorable segments) |
| segments | **367** |
| raw judge mean | 1.44/2 |
| judge noise flags removed | **59 (16 %) strict / 98 (27 %) lenient** |
| **noise-adjusted mean** | **1.55/2 strict** (1.68 lenient) |
| adjusted distribution | **13 / 138 / 216** = broken **3.5 %** / partial **37.6 %** / perfect **58.9 %** (strict) |

This is the definitive quality number for the loop's end-state configuration: same corpus, same defaults as the
39-page deterministic sweep that recorded 9 guard saves and **0 leftovers**.

## Real remaining classes (from the adjusted real flags)

- **Clause omission** (`this piqued my curiosity` dropped while the rest rendered) — a content-loss variant the ratio
  guard cannot see when other clauses keep the length plausible; model ceiling.
- **Transliteration/word choice** (`เมี้ยว` vs `เหมียว` for NYA, `เพราะ` misused for 'that's why') — lexical taste.
- These match the earlier 480-segment profile; no corruption-class defects remain.

## Note on the missing page

One of the 39 payloads had no segment with both source and translation for the judge (all-filtered page); it is not a
failure — the page simply had nothing scorable.
## Render/layout metrics: clean on all 39 pages

Parsed the per-page render + composite telemetry from the same sweep:

| metric | total over 39 pages |
|---|---|
| render.root / inherited | 0 / 0 |
| render.spill / overlap | 0 / 0 |
| render.small_font / suppressed | 0 / 0 |
| composite.root / inherited / invisible | 0 / 0 / 0 |

**No page has a layout defect** (no oversized block leaving the patch, no overlapping text, no text below the font
floor, no invisible composite) — the render side of the end state is deterministic-clean, complementing the text
quality numbers above.

## Classifier note (updated)

The noise classifier now treats **any real typo pair** (left != right) as a real finding, which is conservative: the judge's Thai-tokenizer artefacts often pair near-identical strings, so some of those 37.6 % partial flags are still noise. The honest range is **raw 1.44 / strict-adjusted 1.55 / lenient-adjusted 1.68**, with the 58.9-70.6 % perfect range; the earlier single number (1.68) was the lenient cut.

## v2 end state (2026-10-23, OCR second pass default ON)

Full 39-page sweep with every default as shipped now (no env overrides):

| metric | v1 (pre-OCR) | **v2 (current)** |
|---|---|---|
| pages / regions | 39 / 368 | 39 / **370** |
| gate violations | 1 (`dropped_!`) | **3, all `inconsistent_name`** (HEHE/TSUKUYOMI spellings in doctor runs without `series_context`) |
| leftovers (foreign script / content loss / typo tokens) | 0 / 0 / 0 | **0 / 0 / 0** |
| guard triggers | 9 | 9 |
| judge raw mean | 1.44 (367 segs) | **1.435 (370 segs)** |
| judge distribution 0/1/2 | — | 10 / 189 / 171 |
| wall avg / median | 7.65 s / 6.96 s | **7.64 s / 6.63 s** |
| OCR text-level A/B on changed lines | — | **30/34 (88 %) better** |

The OCR second pass is invisible in the aggregate numbers (it repairs ~10 % of source strings, which moves few judge
segments) and adds no measurable wall time at the corpus level after batching (+0.33 s OCR stage, inside page variance).
Its value is deterministic: on the changed lines the OCR read is better 88 % of the time, and the opposite-meaning
`DEEEND`/`destroy` case is fixed by default.

Remaining defects are the same class as before: model-ceiling nuance/sense on fluent lines (judge 'notes' are the
known typo-noise) plus the name spelling variance that `series_context` fixes in production.
### Official dashboard run on the v2 outputs (`tools/quality_dashboard.py`)

```
pages 39 / regions 370
gate_violations {dropped_?: 1}    leftover {}    (chapter-level name check excluded from the page gate)
timing_ms wall 297937 (avg 7.64 s/page); ocr 60973 (1.56 s/page with the second pass; baseline 1.26 s)
judge segments 370 raw 1.44 / noise_flags 77 / adjusted 1.60
```

So the strict-adjusted end state is **1.55-1.60** depending on the run (v1 1.55, v2 dashboard 1.60); the raw number is
stable at 1.44 and the movement sits in the judge-noise flag count (77 vs 138), i.e. inside the classifier's own
variance, not a proven OCR-pass gain. Quote the range, not a single decimal.
## v3 end state (2026-10-23, tuned OCR threshold + tag-question licence)

Same corpus with the final tuned defaults (`PROB_THRESHOLD 0.75`, cap 8) and the gate/guard tag-question licence:

| metric | v2 | v3 |
|---|---|---|
| pages / regions | 39 / 370 | 39 / **369** |
| gate violations | 3 name + 1 dropped_? | **1 (`dropped_!`)** |
| leftover | {} | **{}** |
| wall avg | 7.64 s | **8.03 s** (single run; translation/OCR variance, +69 ms OCR by design) |
| OCR text A/B on changed lines | 88 % better | unchanged (same machinery) |

Judge was not re-run for v3 (the change only affects 20 more OCR lines, A/B-verified 11 better / 3 worse); the raw
1.44 / adjusted 1.55-1.60 range from v2 remains the reference.
## v4 end state (2026-10-23, final: tuned OCR + tag licence + interjection filter)

| metric | v3 | **v4** |
|---|---|---|
| pages / regions | 39 / 369 | 39 / **365** |
| gate violations | 1 (`dropped_!`) | **0** |
| leftover | {} | **{}** |
| guard triggers | 9 | **5** |
| wall avg / median | 8.03 s / — | **7.80 s / 6.62 s** |
| OCR avg | 1.63 s | 1.63 s (unchanged) |

The v4 sweep was run with every default as shipped now (OCR second pass on, tag-question licence, stronger
`spurious_filler` note, name-safe typo normalizer, interjection filter) and is the **first end state with zero gate
violations and zero leftovers**. Raw judge was not re-run (same 1.44 / 1.55-1.60 range by construction; the changes
only touch OCR-source lines and rare retries).
### v4 official judge run (`tools/judge_translations.py` + `audit_summary.py`)

```
segments 363 (6 lines could not be scored: parse-fail on 2 pages)
raw mean 1.44/2 | noise flags 65 | strict-adjusted 1.58/2
distribution 0/1/2 = 13 / 125 / 225  (broken 3.6 % / partial 34.4 % / perfect 62.0 %)
```

Raw is stable at 1.44 across every sweep (v1/v2/v4), and the strict-adjusted value stays inside the established
**1.55-1.60** band; v4 lands at 1.58 with 62 % perfect segments. The band remains the honest quote because the
noise-flag count moves with which lines the judge happens to note (65-138 across runs), not with the pipeline.
## v5 end state (2026-10-23 late, after interjection filter + consider guard + tag licence)

| metric | v4 | **v5** |
|---|---|---|
| pages / regions | 39 / 365 | 39 / **369** |
| gate violations | 0 (after re-scan) | **3, all understood**: 1 lost `!` (real), 1 rhetorical `?` -> `!` (by design, the retort licence was evaluated and kept), 1 `inconsistent_name` (needs `series_context`, absent in doctor runs) |
| leftovers (foreign/content/typo/filler/rare) | {} | **{}** |
| guard triggers | 5 | **4** |
| wall avg / median | 7.80 / 6.62 s | **7.80 / 6.62 s** |
| HEHE laughter inconsistency | 1 gate finding | **gone** (interjections are no longer names) |

The 4 glitch triggers are the lowest of any sweep; every gate finding has a known cause and none is a pipeline defect.
## v6 end state (2026-10-23 final, every licence live)

| metric | v5 | **v6** |
|---|---|---|
| pages / regions | 39 / 369 | 39 / 370 |
| page gate violations | {} (after re-scan) | **2 on one line** (+1 name variance): `untranslated_word` + `added_latin` on the same Horimiya line |
| leftovers | {} | **{`untranslated_word`: 1}** — the same rare `ATERIAL` line; foreign/content/typo/filler/rare are all 0 (the earlier `{}` claim came from a scan that omitted the untranslated-word predicate; the official dashboard counts it) |
| guard triggers | 4 | 4 |
| wall avg / median | 7.80 / 6.62 s | 7.80 / 6.62 s |
| retort retries | 2 per Horimiya run | **gone** (licensed) |

The one real gate line is a **rare guard failure**: the source `DID ANYONE BRING THE RESOURCE MATERIALS?` shipped
`มีใครเอามATERIALมาบ้างไหม?` — the `untranslated_word` guard fired, but both retries leaked an English variant
(`material` -> `ATERIAL`), exhausting the budget. A direct A/B of three retry notes (none / current / stronger) on that
line produced **0 Latin leaks in 9/9 samples**, so the leak is model variance rather than a weak note; no note change is
justified. Every other gate item is the expected chapter-level name variance that `series_context` fixes in production.
## Footnote: what "leftover" means in these tables

The official `tools/quality_dashboard.py` counts live guard classes still firing **after** the retry loop:
`foreign_script`, `content_loss`, `untranslated_word`, `dropped_question`. Rows in this document that predate v6 were
either taken from the dashboard or from an equivalent custom scan; the v1/v2 rows labelled "foreign script / content
loss / typo tokens" used that narrower custom set, which is why the v6 row is the first to report an
`untranslated_word` leftover (the rare `ATERIAL` line). When in doubt, the dashboard output is the source of truth.