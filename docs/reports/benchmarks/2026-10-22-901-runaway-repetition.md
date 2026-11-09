# #901 — a repetition loop escaped the hallucination check; a runaway-length detector now catches it

- **Date:** 2026-10-22 · **Issue:** #901 · **Files:** `translation_quality.py`, `manga_translator.py`,
  `translators/common.py`.

## How it was found

A null A/A experiment (same translator config run twice, to calibrate judge noise) produced one segment of
**4,462 characters** of `แม่นดูหมั้นแม่นดูรักแม่นดูงาน…` for `YOU WERE SPOT ON, GOD- MOTHER!`.

The pipeline's post-translation check did **not** catch it:

```python
>>> check_repetition_hallucination(bad_4462_chars, 20)
False
```

`check_repetition_hallucination` only flags **consecutive identical** characters or whitespace tokens; the
loop cycles a short *pattern*, so no 20-token run ever occurs. In production that segment would ship to the
renderer (font squeezed to the floor or clipped) — the `_final` run happen to get a clean translation, but the
null run proves the failure mode is real.

## Fix

`translation_quality.runaway_translation(src, dst)`: `len(dst) > 3 * len(src)` **and** `len(dst) >= 120`.
No faithful translation of a 30-character line is 4.4k characters, so the source-anchored ratio is safe, and
the absolute floor keeps very short lines ("!" -> "โอ๊ย!") out of it.

Wired in two places:

1. **Per-region** post-translation check (`manga_translator.py:991-1006`) — a runaway region joins
   `failed_regions` and is retried through the existing `_retry_translation_with_validation`.
2. **Page-level** glitch loop (`translators/common.py::_is_glitched`) — a runaway page output is re-asked at
   the translator level, before the pipeline even sees it.

| verification | result |
|---|---|
| units (`test_translation_quality.py`) | loop flagged; 1.3x longer normal translation not; short outputs not; empty source not |
| integration (`test_custom_openai_glitch_retry.py`) | runaway page reply -> re-ask (2 calls) -> clean output |
| 39-page corpus scan (372 translations) | **0 flagged** — no false positives on real pages |
| gate | **856 passed** |

## Note on the harness

`translation_ab.py` drives the translator only, so the null run exposed a translator-level failure the pipeline
would normally retry. Its page votes therefore measure raw translator output; production adds the pipeline's
post-checks on top. Worth remembering when comparing arm numbers.
