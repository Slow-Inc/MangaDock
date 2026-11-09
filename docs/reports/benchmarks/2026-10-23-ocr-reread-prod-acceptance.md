# OCR second pass, production acceptance with the default ON (2 pages)

- **Date:** 2026-10-23 · sequential `translate_patches` (production-style), real gateway, default env (no
  `MIT_OCR_REREAD`), two real pages; then the same pages with `MIT_OCR_REREAD=0` for a fair delta.

| page | default ON | `MIT_OCR_REREAD=0` | gate |
|---|---|---|---|
| Akuyaku p0 | wall 15.8 s (OCR 2.60 s), 1 re-read accepted (`towardsme that` -> `towards me that`) | 15.0 s (OCR 2.17 s) | 0 violations both |
| Mieruko p0 | 6.3 s (OCR 2.55 s), 0 accepted | 6.1 s (OCR 1.85 s) | 0 violations both |

- Net cost on these two pages: **+0.5 s wall/page on average** (range +0.2 to +0.8), matching the 39-page sweep's
  +0.33 s/page average with page-to-page variance.
- No errors, no gate finding, no layout change; the escape env reproduces the baseline wall times and OCR text.

Conclusion: the default is production-safe; the pass behaves as a small bounded cost and only fires on the lines whose
OCR confidence says they are unreliable.