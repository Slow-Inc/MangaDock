# Opt-in OCR second pass (`MIT_OCR_REREAD=1`): fixes low-confidence misreads, costs ~+1.4 s/page

- **Date:** 2026-10-23 · module `manga_translator/ocr_reread.py`, wired in `_run_ocr` (flag-gated).

## Why

The stress run shipped an opposite-meaning translation because the 48px OCR read `DEEEND` where the artwork says DEFEND
(the detector's 2560 textline box clipped the F edge). Re-detecting or globally enlarging boxes churns the whole chapter
(round 174/175), but re-reading the **same pixels with a padded box** fixes the read: `TO DEEEND` (prob 0.51) ->
`TO DEFEND` (prob 0.90), and the translation goes back to `ปกป้อง` (protect).

## How it works

After the normal OCR pass, lines that are (a) Latin-letter dominant, (b) at least 4 letters and (c) below OCR
confidence 0.78 are re-read with the textline box padded 30 % on each side (clipped to the page). The new text replaces
the old one only when its confidence beats the old by >= 0.12 and the text actually changed. Max 8 re-reads per page.
Unset = byte-identical (no code path runs).

## Full 39-page sweep with the flag

| metric | value |
|---|---|
| re-reads accepted | **67** (~1.7/page) |
| source strings changed | 55/369 (14.9 %) |
| page layout (region-count) changes | **2/39** (the pass never moves a box) |
| OCR stage avg | 1,259 ms -> **2,705 ms** (+1.45 s/page) |
| judge mean | **1.446** (368 segs) vs 1.436 baseline (+0.01, noise) |
| pages better / worse | 17 / 13 / 8 same (noise) |

The pass visibly repairs garbage that used to be translated as-is:

- `DONOT RFHOST THIS CHAPT` (0.39) -> `DO NOT REHOST THIS CHAPTER.` (0.99)
- `CONSIDFR RITYING THF OFFICIAI VOI IIM` (0.20) -> `CONSIDER BUYING THE OFFICIAL VOLUMES` (0.99)
- `WHFN THFY ARF AVAII ARI F IN YOUR RFGION` (0.09) -> `WHEN THEY ARE AVAILABLE IN YOUR REGION.` (0.99)
- `TO DEEEND` (0.51) -> `TO DEFEND` (0.90), `TOKYQ` -> `TOKYO`, `THOUSAND DEVILL` -> `THOUSAND DEVIL`

Some re-reads are punctuation-only churn (`IF?YOU` -> `IF-YOU`, `MANY YOUNG.` -> `MANY YOUNG,`), which is why the pass
also needs the confidence margin.

## Decision

**Opt-in for now (`MIT_OCR_REREAD=1`).** The quality wins are real and deterministic, but the current cost (+1.45 s/page,
~19 % of wall time) is a real tradeoff and the judge is parity (+0.01, inside the noise band). Next tuning steps:
raise the confidence bar to ~0.65 and lower the cap to 4 (most churn attempts happen between 0.65-0.78), re-measure the
stage cost, then re-run the sweep + judge before considering a default. The flag also lets operators use it on
credit/title-heavy chapters where the OCR wins are largest.
## Tuned (round 177): one batched model call per page, threshold 0.65, cap 6

The first version dispatched once per candidate line (~0.27 s of overhead each, +1.45 s/page). Now all candidate crops of a
page are pasted into a single white canvas (8 px side margin, 12 px gaps) and dispatched **once**; results are mapped
back to lines by the returned quad's y-position. Threshold 0.65 (0.65-0.78 was mostly punctuation churn) and cap 6.

| metric | per-line v1 | batched v2 |
|---|---|---|
| accepted re-reads (39 pages) | 67 | **41** |
| source strings changed | 14.9 % | **37/369 (10.0 %)** |
| page layout changes | 2/39 | **2/39** |
| OCR stage delta | +1.45 s/page | **+0.33 s/page (+4 % wall)** |
| Otome p1 line | `DEEEND` | `DEFEND` + `ISLAND` both repaired (master page now `THEY HAVE TO DEFEND THIS DESERTED ISLAND AND FACILITY.`) |

The batched canvas also recovered the `/SLAND -> ISLAND` repair that a cap of 4 had pushed out of the candidate list
(Otome page: candidates 6, accepted 5).

## Status

Still **opt-in** (`MIT_OCR_REREAD=1`) because there is still a latency tradeoff (the loop rule: tradeoff -> opt-in), but
it is now a cheap, bounded lever: +4 % wall for deterministic repairs of the lowest-confidence 10 % of source lines,
with zero layout movement. Remaining check before a default decision: re-judge the tuned corpus (planned next).
## Text-level A/B (new tool `tools/ocr_text_ab.py`)

Rather than relying on the translation judge (noise-dominated), the 34 changed source lines were judged directly:
"which read is the correct English OCR of the artwork?" (A = baseline, B = re-read).

| outcome | count |
|---|---|
| **B (re-read) better** | **30 / 34 (88 %)** |
| A (baseline) better | 2 (not reproducible in a per-pair recheck — judge variance) |
| tie | 2 |

Combined with the sweep (10 % of source strings improved, 2/39 layout changes, +0.33 s/page), this is the strongest
evidence so far that the OCR second pass improves quality rather than churning it. The tool is committed with tests
(`test_ocr_text_ab.py`) and can A/B any two doctor dirs, so future OCR levers get the same objective check.
## Decision (round 179): default ON

The quality-first rule wins here: the pass is a **deterministic source repair** (text-level A/B: 30/34 changed lines
better, 88 %), never moves a box (2/39 layout changes, both from merge rounding), and after batching costs only
**+0.33 s/page (~+4 % wall)** — not a behaviour/UX tradeoff like the batch pipeline, but a small fixed cost.

- **Default ON**, `MIT_OCR_REREAD=0` restores the pre-pass byte-identical behaviour.
- Verified live on Otome p1: default run reads `THEY HAVE TO DEFEND THIS DESERTED ISLAND AND FACILITY.`; with
  `MIT_OCR_REREAD=0` it reads the old `DEEEND`/`/SLAND` line. Suite 961 passed.
- If a deployment cares about the last 4 % of wall time, the escape is one env var; the default follows the
  "quality first, latency after" objective.
## Threshold tuning 0.65 -> 0.75 (round 186)

At threshold 0.65 the cap-6 candidate list rarely filled, so a higher bar mostly adds a few candidates to the same
single batched canvas. Swept 39 pages at 0.75 with the cap raised to 8 and A/B-judged the 20 lines whose source differs:

| outcome | run 1 | run 2 |
|---|---|---|
| 0.75 better | 10 | **11** |
| 0.65 better | 4 | 3 |
| tie | 6 | 6 |

- Changed sources 20/369 (5.4 %), layout change 1 page, **OCR stage +69 ms/page only** (one canvas per page either way).
- Both runs agree on the direction, so the new default is **threshold 0.75 / cap 8**.
## Hardening (2026-10-23, round 197)

OCR confidence can arrive as a numpy scalar or a torch tensor depending on the model path. The pass now converts both
the old and the new confidence to `float` right where they are read, so the comparisons and the debug log
(`f'{prob:.2f}'`) can never fail on a non-Python scalar while the flag is on. Suite unchanged at 964.