# MIT quality loop — final report (2026-10-23, PR #794)

One-page index for everything this loop added, measured and rejected. Detailed evidence lives in the per-topic
benchmarks linked below.

## End state (v4, every default as shipped)

| metric | value |
|---|---|
| corpus | 39 real pages, 365 regions (EN→TH) |
| gate (page-level) | **0 on v5 outputs; v6 live: one rare `untranslated_word` leak (model variance) + name variance** |
| leftovers (foreign script / content loss / typo / filler / lost-as-rare) | **0 / 0 / 0 / 0 / 0** |
| judge | raw **1.44/2**, strict-adjusted **1.58** (band 1.53-1.60), 3.6 % broken / 34.4 % partial / 62.0 % perfect |
| guard triggers in the sweep | 5 |
| wall | avg **7.80 s**, median **6.62 s** |
| guard cost | 0.023 ms/segment, 0.40 ms/page |

## Shipped as defaults (no tradeoff or quality-first)

- **OCR second pass** (`MIT_OCR_REREAD=0` disables): re-reads low-confidence Latin lines with a padded box in one
  batched model call per page. Text A/B: 88 % of changed lines better, `/SLAND`/`DEEEND`/credit-line garbage repaired,
  +0.33 s OCR/page (no measurable wall change after batching). `2026-10-23-ocr-reread-pass.md`.
- **Deterministic typo normaliser**: `แล่ว/ไม/ให/ไมใช` token-level (219/15,590 stored regions), name-safety guard for
  `ไม` (Mai). `2026-10-23-common-thai-typo-normalizer.md`.
- **Leak-script coverage**: 22 scripts detected + salvaged (Arabic included), target-own-script protection, fast path
  keeps guard cost flat. `2026-10-23-leak-script-coverage.md`.
- **Guards**: `dropped_question` tag-question licence (guard + gate share `is_tag_question`), `spurious_filler` stronger
  note (natural `ทน` misses fixed 3/3), **new `consider_as_please`** (CONSIDER→กรุณา; 0 FP on 19,327 regions, natural
  retry fix). `2026-10-23-tag-question-licence.md`, `2026-10-23-spurious-filler-note.md`, `2026-10-23-consider-as-please-guard.md`.
- **Series name memory precision**: interjections are no longer names (HEHE cannot be learned as a character),
  names still learn. `2026-10-23-interjection-not-name.md`.
- **Edge whitespace stripped**; filter-before-translation (#1051) default; hardening: OCR confidence floats, OCR pass
  fail-open.

## Shipped opt-in (a real tradeoff exists)

- `MIT_BATCH_PIPELINE=1` (1.46×, no per-page progress), `MIT_PRELOAD=1` (first page 21.5→18.1 s, holds VRAM),
  `MIT_SEGMENT_RETRY=1`, `MIT_CONTEXT_PAGES`, `MIT_TEMPERATURE` (0.2 A/B inside the noise band), render knobs.
- **`MIT_OMISSION_VERIFY=1`** (2026-10-23 late): semantic verifier for long lines, two agreeing schema-enforced passes,
  re-ask only what it agrees is missing. Deterministic replay proof (clause restored), 0 false flags in 19 clean
  candidates, ~2 verifier requests + 1 re-ask per page on long-line pages. Opt-in because of that latency.

## Rejected with evidence (do not rebuild)

- detection_size 2048/3200, unclip_ratio 2.6 (fixes DEFEND locally, 32.6 % source churn, judge parity), global OCR box
  padding (45.7 % churn), same-crop OCR re-read (junk), panel downscale (12/33 pages reorder), panel-split micro-opt
  (vendored algorithm, panel-identical gate), laughter normaliser (1 real case), clause-omission ratio guard,
  hedging/exclamation guards.

## Remaining

- Model-ceiling sense/nuance in fluent lines (judge range 1.53-1.60 is the honest read).
- Cross-page context is opt-in; single-page production gets name consistency from the series memory only.
- Render/detection campaigns (reference_layout default, SFX default, vertical layout) are separate from this loop.
- **#642 must merge first**, then retarget #794 to `main`, union the three docs conflicts, CI, merge.

## Reproduce

```
cd MIT && .venv/Scripts/python.exe tools/doctor_page.py <pages> --target THA --source ENG --tag _run --out result/doctor/run --no-png --gate
.venv/Scripts/python.exe tools/quality_dashboard.py --doctor-dir result/doctor/run [--audit audit.json]
.venv/Scripts/python.exe tools/judge_translations.py final_audit.json --glob "result/doctor/run/*.doctor.json"
.venv/Scripts/python.exe tools/audit_summary.py final_audit.json
```

PR: #794 (draft, mergeable). CI: logic gate / heavy ML / backend green; Vercel is an external rate limit.

Latest test count: **982 passed** (omit the torch-contract test). All end-state numbers above are from the v4 sweep;
the omission pass is opt-in and not part of those numbers.