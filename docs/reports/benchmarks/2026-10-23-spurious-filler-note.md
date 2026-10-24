# `spurious_filler` retry note strengthened (natural misses it used to ship)

- **Date:** 2026-10-23 · `translators/common.py` note for the `spurious_filler` guard.

## What was wrong

The v2/v3 sweeps shipped two zero-score lines where the model insisted on inserting `ทน` (endure) for an unrelated
source verb, even though the guard fired every time:

| source | shipped |
|---|---|
| `IVE BEEN KILLED BY IT SO MANY TIMES...` | `ฉันทนมันมาหลายครั้งแล้ว...` |
| `THIS IS HOW I DRAIN THE BLOOD IN MY BODY..` | `นี่คือวิธีที่ฉันทนเลือดในกาย...` (earlier run) |

The retry note told the model not to add enduring/tolerating words, but the model kept producing `ทน` variants
(`ฉันทนมันมาหลายครั้ง...` -> `ฉันทนมันมา...`) until the retry budget was spent and the last answer shipped.

## Fix

One sentence added to the same note: *"Translate the source verb literally and never use the word ทน in this
answer."* Measured on the Dungeon page (3 independent runs, the exact natural case):

| run | `IVE BEEN KILLED BY IT...` rendered as | has ทน? |
|---|---|---|
| 1 | `เคยตายเพราะมันมาหลายครั้งแล้ว...` | no |
| 2 | `ฉันถูกมันฆ่ามาแล้วหลายครั้งมาก...` | no |
| 3 | `ฉันถูกมันฆ่าซ้ำแล้วซ้ำเล่า...` | no |

Before the sentence the same page shipped a `ทน` line in every run.

## Scope / risk

The note is only appended on a **retry** after the guard fires (`spurious_filler` is rare: a handful of lines per
corpus), so it cannot affect ordinary translations. A direct-trigger unit test for the predicate already exists;
the note wording is exercised by the natural run above.