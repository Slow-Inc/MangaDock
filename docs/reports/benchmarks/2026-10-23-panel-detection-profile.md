# Panel-detection (Kumiko) profile: where its 509 ms/page goes, and why no safe micro-opt

- **Date:** 2026-10-23 · `cProfile` on the slowest corpus page (Mushoku p0, 1.08 s), plus all-page timing.

## Numbers

- Kumiko across the 39-page corpus: **19.86 s total, 509 ms/page average** (worst 1.2 s) — ~35 % of the
  `textline_merge` stage (~1.45 s/page) and ~6 % of wall.
- Profile of the worst page: `page.split_panels` 0.77 s, of which `panel._cached_split` has **0.57 s *self* time**
  (pure-Python recursion: ~32 k segment intersections, ~21 k candidate panels); `cv2.LSD.detect` only 0.12 s;
  `page.get_segments` 0.29 s.

## Why nothing ships

- The hot path is the recursive split search in vendored Kumiko code; any pruning changes which splits are found, and
  panel ordering is reading order (quality). The same reason killed the 0.5x downscale (12/33 pages reordered).
- A faster micro-optimization is possible in principle (numpy-vectorised segment predicates, early pruning) but can
  only be accepted with a **panel-for-panel identical output on the corpus**, i.e. a larger vendored-code campaign —
  out of scope for this loop and not worth the risk for ~4 % wall.

## Decision

Leave panel detection at full resolution and current algorithm. If a future session wants the 500 ms/page back, the
acceptance gate is: identical panel lists (boxes + order) on all 39 pages, then replay-byte-identical renders.