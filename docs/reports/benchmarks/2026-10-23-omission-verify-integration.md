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