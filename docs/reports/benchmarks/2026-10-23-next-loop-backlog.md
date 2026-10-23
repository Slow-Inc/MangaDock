# Next-loop backlog — what is worth doing once new data (or a merge) lands

- **Date:** 2026-10-23 · current state: branch `feat/mit-quality-loop` ready (PR #794, merge forecast validated),
  end-state quality raw **1.44 / strict-adjusted 1.55** (range 1.55-1.68 depending on judge-noise handling).

Deterministic levers for the existing 39-page EN corpus are exhausted; this is the ordered list of what to do next,
with the acceptance rule for each.

## P0 — unblocked by data

1. **JP corpus expansion (the biggest quality unknown).** The repo has one real JP page (uploaded twice). Get 10-20
   real JP→TH pages, then: re-run the guards/gate sweep (expect the same 0-leftover behaviour), run the noise-adjusted
   judge, and re-test the opt-ins that were data-limited: `render.widen_vertical_columns` (#1006) and the JP rhetorical
   prompt idea (negative on 1 page, needs data). Acceptance: ≥10 real JP pages, gate clean, adjusted judge not below the
   EN baseline minus noise.
2. **Temperature re-test with ≥40 pages or repeated runs.** The 0.5 vs 0.2 A/B (opt-in `MIT_TEMPERATURE`) leaned 0.2
   (raw +0.04, guard hits 10->6) but was inside the noise bar. Acceptance: a paired test clearing the loop's null
   calibration (segment-level binomial with ≥40 pages) before any default change.
3. **Batch pipeline default decision** (#905): 1.46x measured, payload parity verified; the remaining blocker is UX
   (no per-page live progress webhooks). If the Backend progress UX is reworked, flip the default and re-run the
   39-page sweep for a byte-compatible comparison. Acceptance: progress UX no longer depends on per-page webhooks,
   then replay-identical renders.

## P1 — quality improvements needing design

4. **Clause omission** (documented model ceiling): needs a semantic verifier, not a ratio guard (rejected in
   `2026-10-23-clause-omission-rejected.md`). Candidate: ask the translator for a structured per-segment check of
   source clauses, or a second-pass verifier on long lines only.
5. **Fragment completion** (`SOR` -> `ขอโทษ`, `RIGHT..` -> `ใจแล้ว`): no deterministic licence found; a possible angle
   is a source-side cut detector + a shape-preserving retry note. Acceptance: forced-injection proof, then a corpus
   sweep with 0 false triggers on ordinary lines.
6. **Omission verifier precision at scale:** the two-pass probe is 2 agreed / 0 false-positive-agreed on 33 pages, but 2 disagreements were borderline real (tense nuance, dropped number). A wider sample (or 3-pass majority) would settle whether to trust it as an automatic retry trigger.
7. **Interjection/lexical sense errors** (`MAN..` as a greeting, `cute` -> `ตัวเล็ก`) — model ceiling; would need a
   different model or a verifier. Do not attempt with a predicate.

## P2 — operations / maintenance

7. **Merge + retarget sequence** (validated): after #642 lands, retarget #794 to main, resolve the three docs files by
   union, re-run CI, merge. Merge simulation already proved the code auto-merges and the fast suite passes.
8. **Keep the data pipeline clean:** `tools/quality_dashboard.py` + `audit_summary.py` + the fixture tests are the
   standard measurement path; new audits should quote the strict-adjusted number with the 1.55-1.68 range.
9. **Vercel check** is rate-limited externally; not a code signal. Re-run when the window clears.

## Do-not-repeat list (already measured and rejected)

- detection_size 2048/3200 (recall changes), in-page mask/inpaint overlap (#1050 superseded by the batch pipeline),
- JP rhetorical prompt (no difference on the one page), hedging-lost guard (mostly false positives),
- exclamation-lost guard (2 candidates in 15,578 segments), clause-omission word-ratio guard,
- laughter normalisation (2026-10-23): mined strict laughter lines across the corpus — 4 lines, 3 without a Thai laugh
  marker, but only 1 is a real defect (`HEHE.` -> `เข่าเข่า.`; `NYA` -> `เนีย` is a sound transliteration). One case
  does not justify a normaliser; leave it to the model,
- panel-detection downscale (2026-10-23): Kumiko is 509 ms/page (35 % of `textline_merge`); at 0.5x it halves to 257 ms
  but **12 of 33 compared pages reorder the regions** — reading order is quality, so the page stays full-resolution,
- segment-only retry as default (quality risk), neighbour-context retry hint (no reproducible recovery).
## New evidence (2026-10-23): OCR errors are resolution-bound — a targeted second-pass lever

The stress run's opposite-meaning error (`DEEEND` read where the artwork says DEFEND -> translated as destroy) was
reproduced and diagnosed:

| run on Otome p1 | detected source | Thai |
|---|---|---|
| default (detection_size 2560) | `THEY HAVE TO DEEEND ...` | `ทำลาย` (destroy) |
| detection_size 3200 | `THEY HAVE TO DEFEND ...` | `ปกป้อง` (protect) |
| detection_size 4096 | `THEY HAVE TO DEFEND ...` | `ปกป้อง` (protect) |

So the misread is a **pixel-resolution effect**, not a translator fault: with more pixels per glyph the 48px OCR reads
the word correctly. Raising detection_size globally is still the wrong fix (region sets change; rejected earlier), and
even this page needed 3200 (4096 also worked but is slower).

**Follow-up experiment (same day):** tried to reproduce the read by re-running the OCR model on hand-cropped line
images from the page (tight, padded and 2x-interpolated crops). The crops read as junk (`TODe`, `BEA`) instead of
DEFEND, which means the win at detection_size 3200 is **not extra pixels in the crop** — it is the detector's
**textline-box geometry** (the 2560 boxes clip the F edge, so the model sees `DEEEND`).

So a same-box second-pass OCR would not fix it. The viable targeted design is **localized re-detection at a higher
resolution for suspicious lines** (re-run detection on the page region around a low-confidence line, keep the price
local instead of raising detection_size for the whole page). Gated behind a flag first, with the same forced-fixture +
corpus-sweep evidence the other levers used. Line crops alone are disproven — do not rebuild that.
### Evaluated 2026-10-23 (round 188): number-preservation guard - **rejected**

Measured every v7 region whose source carries a digit count against its Thai translation (`20` regions). Only three
looked like a missing number, and all three were **OCR garbles of words**, with correct translations:

- `EH.. YOURE JUST 60NNA SIT WITH ME?` -> `เอ่อ... เธอแค่อยากนั่งกับฉันงั้นเหรอ?` (`60NNA` = GONNA)
- `HUH2!` -> `เฮ้!` (`2` = `?`)
- `... EQUIPPED 7BYTHE PROTAGONIST` -> `...ที่ตัวละครเอกเท่านั้นที่สวมใส่ได้` (`7BYTHE` = BY THE)

A number guard would fire on OCR noise, not on translation defects. Revisit only if a future run shows a genuinely
lost numeric fact (price, count, time) - and then scope it to standalone numbers, not digit-bearing tokens.