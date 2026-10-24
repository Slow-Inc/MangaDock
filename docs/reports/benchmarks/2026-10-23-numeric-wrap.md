# #842/#844 — line wrapping never splits a number; นาทีละ breaks at its word boundary

- **Date:** 2026-10-23 · **Files:** `rendering/text_render.py`, `test/test_thai_wrap.py`.

## Findings

1. **Thai segmenter tie (#844):** `_insert_thai_word_breaks('นาทีละ 5,000 เยน')` already produces
   `นาที\u200bละ` — the break is between the words `นาที` + `ละ`, never `นา|ทีละ`. The historical failure no longer
   reproduces; a test now pins it.
2. **Numbers could be broken mid-digits (#842 family):** a narrow wrap width split `30,000` into `30,00` / `0`
   (and `12:30` similarly) because the syllable pass treats an unhyphenatable token as char-splittable.

## Fix

Number-like tokens (`^[0-9][0-9.,:%/-]*$`) are now **atomic** in `_split_into_syllables`: they are never
hyphenated or char-split, so a number that does not fit overflows the line rather than losing digits. Normal Thai
and Latin wrapping is untouched (all 47 Thai-wrap tests pass, including the existing cluster/mark cases).

## Tests

- `30,000` stays whole at widths 40/60/80/120 px;
- `50%` and `12:30` stay whole at 40 px;
- `นาทีละ` breaks as `นาที|ละ`.

## Risk

Only engages when a numeric token is wider than the wrap width; production clean-layout floors already keep the
column at least as wide as its widest token, so normal pages are unaffected. Safe-by-construction tests cover the
behaviour.