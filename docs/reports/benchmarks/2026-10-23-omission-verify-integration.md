# Opt-in omission verification pass (`MIT_OMISSION_VERIFY=1`) — wiring landed

- **Date:** 2026-10-23 · `manga_translator/omission_guard.py`, wired after the translation stage in `translate_patches`.

## Why

Clause omission is the one measured defect class with no deterministic predicate: e.g. `ALSO... THIS PIQUED MY
CURIOSITY EARLIER IN THE DINING HALL` shipped as `แล้ว... เมื่อตอนกลางวันในโรงอาหาร` (the curiosity clause gone). The
word-ratio guard was rejected because compact titles share the same ratio (2026-10-23 note). A semantic verifier can
see it: the earlier report-only tool caught it on 2 of 2 clear cases with JSON mode having 0 parse failures.

## Design (off by default)

1. After translation, collect long source lines (>= 8 English words, non-empty Thai answer).
2. One batched verifier call per pass (JSON mode), **two passes required to agree** before a line counts as omitted.
3. Re-ask only the agreed lines with a note naming the missing words; accept the new text only when it is at least
   3 characters longer (a dropped clause means more content) and non-empty.
4. Every failure is caught: the pass can never fail a page; unset flag = byte-identical old path.
5. Retry uses a fresh chatgpt translator (no page context) — the documented tradeoff that keeps this opt-in, same
   shape as `MIT_SEGMENT_RETRY`.

## Status

- Module + 7 pure/injection tests (collect/prompt/parse/distribute/apply/two-pass agreement/flag). Suite **974 passed**.
- Wired into `translate_patches` behind `MIT_OMISSION_VERIFY=1`; logging behind `MIT_LOG_OMISSION_VERIFY`.
- **Pending before any default decision:** natural proof on the Akuyaku page (verifier flags the curiosity clause, the
  re-ask restores it) and a corpus sweeper for false positives/latency; invitation to re-judge the affected pages.
## Natural proof (Akuyaku p0, `MIT_OMISSION_VERIFY=1`)

Default pipeline shipped this line with the clause gone:

- source: `ALSO... THIS PIQUED MY CURIOSITY EARLIER IN THE DINING HALL,`
- default: `แล้ว... เมื่อตอนกลางวันในโรงอาหาร`

With the pass enabled:

- **`แล้วอีกอย่าง... เมื่อสักครู่ในโรงอาหารนี้ ก็จุดประกายความสงสัยของฉัน`** — the curiosity clause is back.

So the verifier + re-ask works on the measured case.

## Cost (measured, this is why it stays opt-in)

The run took **32.5 s wall** on that page (dense page, cold-ish start: detection 6.7 s), versus the ~15 s the same page
takes in the default pipeline: the pass adds **~3 gateway round-trips** (two verifier passes on the page's long lines
plus one re-ask batch), each on the order of seconds. That is acceptable as an opt-in for quality-critical chapters, not
as a default.

Next tuning ideas before any default decision: a single verifier pass (halves the cost; two passes were a stability
cushion), or verify only lines that the content-loss predicate already suspects. Both need a corpus sweep with the
translation judge to prove they keep the win.