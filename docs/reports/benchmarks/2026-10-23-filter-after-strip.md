# #1051 — source-language filter moved after the noise strip (default ON for the patch/batch path)

- **Date:** 2026-10-23 · **Issue:** #1051 (unblocks #1050) · **File:** `manga_translator/manga_translator.py`.

## What changed

The source-language filter used to run only in `_finish_patches`, i.e. **after** the page had already been
translated — the gateway was asked to translate lines that were then discarded. It now runs inside
`_run_text_translation`, **immediately after `_strip_source_noise`** (on exactly the text the translator is about
to send), and `_finish_patches` reuses that list instead of filtering again (so langdetect cannot flip between two
calls). Marked `ctx.patch_mode`, so the full-page `translate()` API is unchanged; `MIT_FILTER_AFTER_STRIP=0`
restores the old behaviour.

## Evidence

**Replay A/B (same recorded translations, only the region/line set can differ) — rendered PNGs byte-identical:**

| page | filter result | render |
|---|---|---|
| Boku p0 (17 front regions, 5 dropped) | kept 12 | identical |
| Otome p0 (11, 1 dropped) | kept 10 | identical |
| Horimiya p0 (no drops) | unchanged | identical |

**Live latency on the mixed page (Boku p0, two reps):** translation **3.62 s -> 2.12 s** and **1.96 s -> 1.74 s**
(fewer prompt lines: 12 instead of 17); wall followed. Two-page sanity run at HEAD: gate 0 violations, kept=12/11.

## Default

ON for the patch/batch path (`MIT_FILTER_AFTER_STRIP=0` disables). The rendered set is identical under replay and the
only live difference is that the model no longer receives non-source lines it was never allowed to render — fewer
tokens, less latency. The full-page `translate()` endpoint is untouched.

## Why this matters beyond the latency

With the filter applied before translation the region list is **stable between translation and rendering**, which
is exactly the precondition #1050's mask+inpaint overlap was blocked on.