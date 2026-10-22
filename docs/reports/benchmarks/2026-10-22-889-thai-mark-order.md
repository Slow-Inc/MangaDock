# #889 Thai combining marks out of canonical order — normalised before rendering

- **Defect:** the model occasionally returns a tone mark **before** its above-vowel (`ท` + `่` + `ี` instead of
  `ที่`, `น` + `้` + `ี` instead of `นี้`). Unicode canonical order puts vowels (ccc 103) before tone marks
  (ccc 107); no shaper renders the reversed order correctly, so the word ships visibly mangled.
- **How found:** the prompt-v3 A/B (#888) — 1 segment in 9 pages for the v2 arm, 3 for v3 (all on the Iruma
  page). The 39-page dump had none, so it is rare but real.

## Fix

`translation_quality.normalize_thai_marks(text)`: for every run of Thai combining marks after a base
character, vowels keep their relative order and move before the tone marks; an exactly repeated mark in the
same cluster is dropped (`ก้้` -> `ก้`). Wired into `CommonTranslator._clean_translation_output`, so every
translation passes through it before rendering.

| verification | result |
|---|---|
| v2 arm outputs | invalid order 1 -> **0** |
| v3 arm outputs | 3 -> **0** |
| 372 corpus translations | **0 changed** (byte-identical where the text was already valid) |
| tests | 3 (`ท่ี`->`ที่`, `น้ี`->`นี้`, duplicate drop, valid/other-script untouched) |
| gate | **849 passed** |
