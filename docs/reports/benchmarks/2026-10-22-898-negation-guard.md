# #898 — a dropped Japanese negation is re-asked (JP→TH inverted in 2 of 4 runs)

- **Date:** 2026-10-22 · **Issue:** #898 · **Files:** `translation_quality.py`, `translators/common.py`.
- **Defect (real JP→TH path, the two uploaded Japanese pages):** `でも可愛くないなコイツ` ("this kid isn't
  cute") came out with the meaning **inverted** in 2 of 4 runs (`แต่เด็กนี่น่ารักดีนะ`), a third run landed on a
  different negative, only one was right — sampling-driven, not a one-off.

## Fix

- `translation_quality.negation_lost(src, dst, target)`: a **Japanese** source with a clause-final negation
  (`ない`, `ません`, `なかった`, `じゃない`, `ではない`, `ありません`, `ないで`, `なくて`, `なく`, `ずに`, `まい`) whose
  Thai translation has **no** Thai negation marker (`ไม่`, `ไม่ได้`, `ไม่ใช่`, `อย่า`, `ห้าม`, `ไม่เคย`, `มิได้`, `ไร้`).
  Clause-final forms only — a bare `ず`/`ぬ` would match ordinary words (`まず`, `はず`).
- It feeds the translator's existing retry loop (`_is_glitched` + `_INVALID_REPEAT_COUNT` = 2 in
  `custom_openai`), and `_modify_invalid_translation_query` appends an explicit "keep the negation" note to the
  re-asked query.

## Scope: Japanese sources only

The EN→TH path is deliberately untouched: its idioms legitimately lose the word ("like there's no tomorrow" ->
ราวกับวันสุดท้ายของชีวิต). A corpus scan of 372 EN regions flagged exactly that one idiom, so a source-agnostic
check would have cost a retry there for nothing.

| verification | result |
|---|---|
| unit tests (`negation_lost`) | flagged for `可愛くない` -> `น่ารักดีนะ`; not for `ไม่น่ารัก`; EN idioms clean |
| integration (glitch-retry file) | inverted first reply -> re-asked -> correct, **2 gateway calls**; EN source stays at **1** |
| real JP page, 5 runs after the fix | **5/5 kept the negation** (before: 2/4 inverted) |
| gate | **852 passed** |

## Cost

A page is re-asked only when a negation was actually dropped (at most the existing 2 retries), so the common
case is unchanged: the five JP runs measured translation 1.7-2.6 s, the same band as before the guard.
