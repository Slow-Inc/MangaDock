# The pipeline is deterministic when live calls are out of the picture — verified

- **Date:** 2026-10-22 · **Question:** does a same-config rerun produce identical detection/OCR/translation
  output, or is there cuDNN nondeterminism to control?
- **Method:** 3 pages (Dungeon p0, Boku p1, Akuyaku p0) replayed twice each with `--replay` and
  `--set ocr.vlm_rescue=0`, then compared region-for-region.

## Result — identical

| page | regions | textlines | identical (xyxy + src + dst + branch + font) |
|---|---|---|---|
| Dungeon p0 | 6 / 6 | 22 / 22 | **yes** |
| Boku p1 | 11 / 11 | 35 / 35 | **yes** |
| Akuyaku p0 | 11 / 11 | 42 / 42 | **yes** |

## And DBNet does not need cuDNN-off

Following #884's OCR pattern, DBNet's forward was re-run with cuDNN disabled for this page: **identical boxes**
to the cuDNN run, and slower (`detection 3726/3692 ms` vs `3466/3612 ms`, cold runs). No code change — the
detection stage is already deterministic and cuDNN-off would only cost time (unlike the OCR model, which had
the Windows host-side cuDNN pathology).

## Methodology rule (replaces the wrong note in #891)

With `--replay` + `--set ocr.vlm_rescue=0` the pipeline is deterministic; every observed difference between two
runs is then attributable to a config change, a code change, or a live gateway call (translation of unseen
texts, vision rescue). Compare A/Bs accordingly — and always double-check that both arms really used the
intended config before reading meaning into the diff.