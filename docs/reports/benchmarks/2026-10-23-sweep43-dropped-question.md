# Sweep 43 + the dropped-question guard (#1056)

- **Date:** 2026-10-23 · 13 remaining corpus pages (the sweep now covers all 39 with current defaults), `MIT_LOG_GLITCH=1`,
  gate.

## Sweep findings

| finding | triage |
|---|---|
| 3 `spurious_filler` triggers | 2 true-positive-adjacent (`ฉันทนทน` garbage; `ฉันทัน...` after a retry) and one **legitimate `ทน`** (`IVE BEEN KILLED BY IT` -> `ฉันทนมันมาหลายครั้ง`) — the guard cannot tell a real "endure" verb from filler on this line; final shipped text reads naturally |
| gate `dropped_?` | **real defect**: `FOR NO REASON? ...` shipped as a flat statement (`ไม่มีเหตุผลเลย! ...`) — the questioning retort was lost |
| gate `added_latin: ATERIALS` | real: an untranslated English word glued to Thai (`มีใครเอามATERIALS มาบ้างไหม?`) — tracked as a design issue (#1057), not rushed into a predicate |

## New guard: `dropped_question` (#1056)

`translation_quality.dropped_question(src, dst, to_lang)` is true only when the source has `?` **and** the Thai
target contains no question marker at all (`?`, หรือ(เปล่า/ไม่/ไง), ไหม, มั้ย, เหรอ, หรอ, หรือ, อะไร, ทำไม, ยังไง,
อย่างไร, เท่าไหร่, แค่ไหน, ที่ไหน, ใคร, เมื่อไหร่). Thai realises questions with particles, so a *total absence* is the
signal; the retry gets a note to keep the question (e.g. ไหม / หรือเปล่า).

Wired the same way as the other guards: predicate -> `_is_glitched` reason -> retry note, with tests (predicate cases
and the trigger). The heuristic risk is a statement that happens to speak about a question — the marker search covers
the Thai question words, so the retry note simply asks the model to keep the nuance; worst case is one extra call.