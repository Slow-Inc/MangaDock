# #903 — Cyrillic leaks in Thai output (Tsukuyomi -> ЦУКУโยมิ) and the retry that now names the script

- **Date:** 2026-10-22 · **Issue:** #903 · **Files:** `translation_quality.py`, `translators/common.py`.

## How it was found

A script audit over **11,128 stored src/dst pairs** (all runs) looked for characters whose script appears in the
output but not in the source. Hits: **169** — but they are the same **5 segments on 3 pages** repeated across
~34 historical runs:

| page | source | output |
|---|---|---|
| Otome p0 #10 | `THEYRE'SO STRONG THAT THEY CAN BE CALLED' CHEATS,` | `…เรียกว่า ' ЧИТ' (โกง) ได้เลย,` |
| Tsuki p0 #6/#7 | `TSUKU- YOMI..` / `…AROUND TSUKUYOMI, I` | `ЦУКУโยมิ..` / `…รอบตัว ЦУКУโยมิ …` |
| Tsuki p1 #1/#2 | `I WANTED TO SEE YOU AGAIN, TSUKU- YOMI!` / `TSUKU- YOMI!` | `…อีกทีนะ ЦУКУโยมิ!` / `ЦУКУโยมิ!` |

The model transliterates **Tsukuyomi into Cyrillic** (ЦУКУ + Thai โยมิ) and "CHEATS" into `ЧИТ`. The existing
`foreign_script` guard **does** flag these and the translator re-asks up to `_INVALID_REPEAT_COUNT` times — the
model simply repeats itself, so the leak shipped.

## Fix

The retry now says *why*, the same way the negation note does (#898):

- `translation_quality.leaked_script(trans, query)` -> `'cyrillic' | 'hangul' | 'cjk' | None` — one definition
  for "the output uses a script the source does not".
- `_modify_invalid_translation_query` appends: *"the previous answer used {script} letters that do not appear in
  the source. Write the whole answer in the target script only — transliterate names into Thai letters
  (Tsukuyomi -> สึกุโยมิ)."*

## Verification

| check | result |
|---|---|
| units | ЦУКУ / ЧИТ / 围绕 / 한국어 flagged with the right script; clean Thai and Cyrillic-in-source not flagged |
| integration | Cyrillic reply -> retry carries the note -> clean Thai (2 calls) |
| live | the 3 affected pages re-run **twice** (6 files, 92 segments): **0 leaks** (baseline: 5 segments) |
| gate | **858 passed** |

Historical stored outputs are unchanged (they are records); the fix applies to new runs.
