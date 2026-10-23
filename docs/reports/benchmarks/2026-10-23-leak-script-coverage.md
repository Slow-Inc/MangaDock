# Leak-script coverage closed: Arabic and the remaining scripts now detected/salvaged; target scripts safe

- **Date:** 2026-10-23 · `translation_quality.py` (`_LEAK_SCRIPT_CHARS`, `_TARGET_OWN_SCRIPTS`, `foreign_script`,
  `strip_leaked_script`), tests.

## Two gaps found

1. **Salvage did not cover Arabic.** The live sweep flagged an Arabic leak (`قوية` inside Thai) and the retry fixed
   it — but the last-resort `strip_leaked_script` table only had cjk/kana/hangul/cyrillic, so an exhausted retry would
   have shipped the Arabic glyphs.
2. **Salvage could strip the target's own script.** `strip_leaked_script(..., to_lang='JPN')` would delete kana from a
   Japanese translation when the (English) source lacked kana — a latent bug for any non-Thai target.

## Fix

- One extended table `_LEAK_SCRIPT_CHARS` (22 scripts: CJK, kana, hangul, Cyrillic, **Arabic**, Greek, Hebrew,
  Devanagari, Bengali, Tamil, Telugu, Kannada, Malayalam, Sinhala, Lao, Khmer, Myanmar, Tibetan, Ethiopic, Armenian,
  Georgian) now serves both the detector and the salvage.
- `foreign_script` additionally checks this table (lang_ratio only models THA/CJK/KOR/ARA/Cyrillic), with the same
  source-licence rule and the neutral `・/ー` punctuation excluded.
- `_TARGET_OWN_SCRIPTS` lists each target's own scripts; the salvage skips them, so a Japanese target keeps kana.

## Evidence

| check | result |
|---|---|
| Greek/Devanagari in Thai output, English source | flagged; not flagged when the source uses that script |
| Arabic salvage | `มี قوية ด้วย` -> `มี ด้วย` |
| JPN target, English source | kana preserved |
| THA target | kana still stripped |
| suite | **953 passed** (4 new tests) |