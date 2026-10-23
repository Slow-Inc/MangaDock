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
### Evaluated 2026-10-23 (round 190): English negation-lost guard - **rejected**

Scanned v7: 40 regions have an English negation; only 4 Thai outputs lacked a negation marker, and none was systematic:

- `WITHOUT HOLDING BACK` -> `จนหมดรูป` / `จนแหลกสลาย` / `โดยไม่ไว้หน้า`: idiomatic, meaning kept; a guard would fire without
  a defect (the direct A/B baseline kept negation in 2 of 3 samples and the marker-less one is still correct).
- `DO NOT REHOST THIS CHAPTER.` -> `ห้ามนำบทนี้ไปเผยแพร่ต่อ`: the Thai uses `ห้าม` (prohibition), which the scan's marker
  list lacked - a false positive by construction.
- `WONT IT TURN INTO...` -> `มันจะกลายเป็น...`: tag-question style; the direct A/B kept a marker in 2 of 3 baselines.
- `I DONT WANT THEM.` -> `ฉ-ฉันท้องอยากได้มัน`: a real one-off glitch, but the same source kept the negation in **3 of 3**
  baseline samples and in the retry-note sample - rarity, not a class.

A negation guard would have retried on idiomatic/threshold false positives while almost never meeting a real defect.
Revisit only with a semantic verifier, not a marker scan.
### Candidate for a future loop: term/register consistency memory (evidence 2026-10-23, round 193)

`tools/stability_audit.py --runs 3` on the current defaults shows the model is stable in meaning but **varies recurring
terms and pronouns** across runs/pages:

| segment | run-to-run variants |
|---|---|
| `I BECAME A DEMON LORD` | `ฉันกลายเป็นเจ้าชายปีศาจ` / `ข้ากลายเป็นจอมมาร` / `ข้ากลายเป็นจอมมารแล้ว` |
| `DO YOU KNOW WHAT KIND OF THING A DEMON LORD IS?` | `เจ้าชายปีศาจ` / `จอมมาร` |
| `IVE GOT ALLERGIES...` | `ฉันแพ้...` / `ฉันแพ้สาร...` (fine) |
| pronouns | `ฉัน` vs `ข้า` for the same speaker |

Names are already covered by the series name memory; **common terms** (`DEMON LORD`) are not, because the memory only learns
name-focused lines (single Latin name + short Thai run). A term memory would need: recurring-titlecase extraction, a
target registered in the series key, and a licence so ordinary words are never enforced. This is a new feature with real
FP risk - do it as its own loop with a judge A/B, not as a tail-end patch.
### Evaluated 2026-10-23 (round 204): intra-page name unify - **not needed**

Scanned all v8 pages for a name that appears on multiple lines with different Thai spellings inside the SAME page:
**0 of 39 pages**. The model is already consistent within a page; the observed variance (TSUKUYOMI) is cross-page and is
covered by the production series memory plus the token-level fix (#1065). Adding a page-level normaliser would be
complexity without a defect to fix.
### Measured 2026-10-23 (round 207): stylised display headings are a detection gap, not a resolution problem

The Tsuki page's `2ND NIGHT: WHAT LIES AHEAD OF THE EDGE OF THE WORLD?` heading is never translated. It is absent from
both `regions` and `dropped` in the doctor payload. Re-running the page at `detector.detection_size=3200` and `3840`
(default 2560) still produced **no region** containing `NIGHT`, so raising resolution does not recover it.

Closing this as out-of-scope for the translation loop: it needs a detector/preprocessing change (outlined display
lettering class, e.g. an inverted/edge-enhanced second detector pass), which is a separate render/detection campaign with
its own false-positive risk (logos, SFX, art text).
### Candidate: second retry should send only the flagged segments (measured cost, needs forced A/B)

After batching the SFX vision calls, the remaining latency cost on glitched pages is the retry policy: by default a
single invalid segment re-translates the **whole page** (`MIT_SEGMENT_RETRY` switches to the flagged subset but stays
opt-in because the page context is believed to help quality).

Measured on the corpus Tsuki page: one `foreign_script` glitch -> translation stage **11.0 s** vs 3-4 s unglitched,
because attempts 2 and 3 each re-send every line (3x page traffic).

wrong) but send only the flagged subset for **attempt 3** - at that point the whole page already failed twice with the same
wrong) but send only the flagged subset for **attempt 3** - at that point the whole page already failed twice with the same
context, so page-mates are not the variable. Needs the forced-glitch harness to compare final quality attempt-3
subset vs whole-page before it can be a default; if that A/B is neutral, the default saves ~2-4 s on pages whose glitch
survives the first retry.
### Measured 2026-10-23 (round 220): remaining merge outliers are panel/bubble detection plus SFX prefetch

v9 per-page timings: `textline_merge` averages 1.8 s with outliers 5.7-9.2 s (Mushoku, Kage, Tsuki p1). Profiling the
Mushoku outlier: Kumiko panel detection **2.13 s** (`_cached_split` 1.46 s over 16 panels), bubble detection **0.78 s**,
and on pages with SFX candidates the vision prefetch (already concurrent) adds its gateway wait. The SFX part cannot
shrink further without dropping candidates (quality tradeoff), and the panel/bubble work is the layout contract that
the render stage relies on (a downscale/disable campaign was already rejected earlier for panel-order changes). Close this
for the current loop.
### Re-evaluated 2026-10-23 (round 232): temperature 0.2 vs 0.5 for glitch rate - no effect

The bad model windows suggest asking whether a lower sampling temperature reduces guard-trigger frequency. Paired A/B
(same 8 pages, alternating order, `translator.temperature=0.2` vs the 0.5 default, `MIT_LOG_GLITCH` on):

| arm | pages | guard triggers | avg translation stage |
|---|---|---|---|
| default 0.5 | 8 | **2** | 4136 ms |
| 0.2 | 8 | **2** | 3239 ms |

The trigger rate is identical; the small stage-time difference is sampling luck (same retry policy). No reason to change
the quality-first default - temperature stays 0.5 and `MIT_TEMPERATURE` remains the opt-in knob.

### Side-effect audit of the round-274 licences (round 231)

v10 has only two source-`!` lines whose Thai carries no punctuation/emphasis particle: one is the licensed strong
negation (`T THATS NOT IT!` -> `ฉ- ไม่ใช่อย่างนั้น`), the other keeps the surpresa nuance with `หรือ?`
(`IT WONT KILL ME?!` -> `มันไม่ทำให้ฉันตายหรือ?`). The licence is narrow; no shipped defect is hidden by it.