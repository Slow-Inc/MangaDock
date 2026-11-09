# Null A/A calibration — a same-config pair scores 8-3 at page level, so 12-page A/B margins are noise

- **Date:** 2026-10-22 · **Issue:** #902 · **Design:** one translator config run twice over the same 11 pages
  (sampling is the only difference), blind packet (seed 37), same pairwise judge.

| level | A (first run) | B (second run) | tie |
|---|---|---|---|
| page votes | **8** | **3** | 0 |
| segment votes | **50** | **37** | **29** |

## Reading it

- 87 decided segments split 50/37 = 57.5 %, about **+1.4σ** from a fair coin (p ≈ 0.16). With *identical*
  configs. So the judge's per-page noise can produce an 8-3 page split.
- No slot bias: the winner did not track the X/Y position (A won 11 segments in the X slot and 39 in Y, B 29 in
  X and 8 in Y) — the split comes from per-page variance, not blind ordering.
- Page-vote margins of **≤5 pages at 11-12 pages are inside the noise band**.

## What that does to the loop's earlier numbers

| experiment | page votes | verdict under calibration |
|---|---|---|
| few-shot EN prompt vs shipped | 7-5 | noise |
| temperature 0.0 vs 0.5 | 7-4 | noise (borderline) |
| concise vs base | 5-5 | noise |
| JP prompt vs shipped | 2-2 | noise |

Every one ended in "no default change" — this calibration is why that was the right call, and it means the loop
cannot claim a translation-prompt win from a 12-page A/B at all. Future translation A/Bs need ≥40 pages, repeated
runs aggregated, or segment-level counts with a binomial check.

## Two side findings

1. The null run contained the **4,462-character repetition loop** that became #901. The judge voted for the other
   arm on that segment — catastrophic output *is* caught; the noise is in close calls.
2. `translation_ab` exercises the translator only (no pipeline post-checks), so page votes measure raw translator
   output. #901's detector now covers that case in production.

## Process rule (vault + issue)

- Treat a ≤5-page margin at 12 pages as no effect.
- Prefer ≥40 pages or aggregated repeats; report segment-level decided counts with ties.
