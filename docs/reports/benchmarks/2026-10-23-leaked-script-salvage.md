# Leaked-script salvage: the retry-exhausted answer no longer puts foreign glyphs on the artwork

- **Date:** 2026-10-23 · **Issue:** #903 follow-up · **Files:** `translation_quality.py`, `translators/common.py`,
  tests.

## Problem

The guards re-ask a segment that leaks a foreign script (CJK/Cyrillic/Hangul), but the repeat budget is
`_INVALID_REPEAT_COUNT = 2`. A real page (Tsuki p0) went **CJK leak -> CJK leak -> filler** across the three
attempts, so the last, still-glitched answer shipped — Chinese characters on the page.

## Fix

`translation_quality.strip_leaked_script(trans, query, to_lang)` runs in the final `_clean_translation_output` pass:

- removes characters of CJK / Kana / Hangul / Cyrillic **only when the source does not use that script** (a JP
  kana SFX copied into a Thai line stays);
- collapses doubled spaces and falls back to the original text when nothing would remain;
- costs no model call and cannot affect a clean answer (it is a pure string pass).

## Evidence

| check | result |
|---|---|
| stored leaked regions (all doctor runs) | **182 changed -> 182 foreign-script-free** |
| examples | `ЦУคุโยมิ..` -> `คุโยมิ..`; `...округ ЦУКУ_โยมิ` -> Thai-only; `1 รょう` -> `1 ร`; `' ЧИТ' (โกง)` -> `' ' (โกง)` |
| source-script licence | `ドン! ลาก่อน` with a kana source is unchanged |
| clean traffic | 2 fresh pages with the salvage active: 0 leaked-script regions, nothing stripped beyond a pre-existing English title region (never touched by the pass) |
| mocked translator | three leaking answers -> `call_count == 3`, final output contains **no** foreign-script glyphs |

## Tradeoff / default

No tradeoff for clean output, no latency cost: the only changed cases are answers that already violated the
script contract. Worst case they become broken-but-Thai instead of foreign glyphs on the art. Shipped as a
default fallback (not opt-in).