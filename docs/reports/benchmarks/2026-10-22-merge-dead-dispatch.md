# Dead second merge dispatch removed — and a measurement caveat that changes how stages get ranked

- **Date:** 2026-10-22 · **Issue:** #885 · **Change:** `_run_textline_merge` dispatched the merge twice; the first result was stamped with `text_raw` and then thrown away.

## Why the first dispatch was dead

`dispatch()` builds **new `TextBlock` objects** for every call, so the regions the first pass returned were
garbage after the second dispatch overwrote the variable. The only side effect — `region.text_raw =
region.text` — landed on those thrown-away regions, which is also why consumers
(`manga_translator.py:417/422`, `rendering:792`, `batch_orchestration:36/38`) never saw a `text_raw` and fell
back to post-dictionary text (#885 tracks restoring it).

## Verification

- Whole-page profile: the merge module costs **0.185 s for two dispatches** (~0.09 s each) — the dead pass was
  ~0.1 s/page, not the 2-5 s the stage timer sometimes showed.
- Replay A/B (same code, change stashed vs applied) on two deterministic pages: **renders byte-identical**
  (`Boku p1`, `Dungeon p1`).
- `Horimiya p0` differs, but not from this change: running the *same* code twice gives the same two diffs
  (SFX rescue `ฟึ่บ` vs `วูบ`, and a live translation of `STRANGELY…` that the recording never saw).

## The caveat (worth more than the 0.1 s)

Stage timers (`timing_ms`) are **wall time of a coroutine on a busy host**, and they vary up to **6×** for the
same page and code: `textline_merge` measured 782 ms and 4828 ms on `Boku p1` in back-to-back runs. The
"textline_merge is 35 %" reading in the round-4 profile came from such a run (the machine had a second
pipeline running) — it is not a real stage cost.

**Rule for speed work here:** rank stages by profiler cumulative time (and repeated medians), never by a
single `timing_ms` reading, and never time while another job is running on the machine.

## Where the merge stage's seconds actually go (cold profile, one page)

| callee | time |
|---|---|
| `sort_regions` -> `get_panels_from_array` (**Kumiko** panel detection) | **2.04 s** |
| `dispatch_textline_merge` (the merge itself) | 0.185 s for two calls |
| `_textline_containers` (bubble association) | 0.016 s |

So the stage that report called "textline_merge" is mostly **panel detection for reading order**
(`sort_regions` runs Kumiko on the page at `manga_translator.py:856`, inside the merge stage). That is the
next real target: panel detection is CPU-bound Python on the full-resolution page, and a downscale is the
obvious lossless-looking lever — but it changes panel boxes, which changes reading order, so it needs a
39-page replay A/B before it can default.
