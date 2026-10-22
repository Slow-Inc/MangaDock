# #1039 — the model adds Thai filler words the source never says (ทน / ทัน); deterministic guard + retry note

- **Date:** 2026-10-23 · **Issue:** #1039 · **Files:** `translation_quality.py`, `translators/common.py`, tests.

## How it was found

A judge audit of 8 fresh HEAD pages (85 segments, raw mean 1.45/2 — depressed by the judge's known typo noise)
surfaced two real meaning flags on the Tsuki page:

| source | shipped Thai | problem |
|---|---|---|
| `I AM GRANTING YOU ALL THE POWER I CAN.` | `ฉันทันมอบพลังทั้งหมดที่มีให้เธอ` | `ฉันทัน` is ungrammatical |
| `I CANT EVEN GIVE YOU ANY POWER` | `ฉันทันด้วยซ้ำที่มอบพลังอะไรให้เธอไม่ได้` | same filler |

A historical variant is the same class: `I HEARD YOUR CONVERSATION WITH THE GODDESS.` ->
`ฉันทนฟังบทสนทนาของเธอกับเทพธิดาแล้ว` (adds ทน 'endure'). A Thai reader stumbles even though the core meaning
survives, which is why the judge scores 1/2.

## Fix

`spurious_filler(dst, query)` (Thai targets):

- `ทน`-family after a pronoun/verb (`ฉันทน`, `ทนฟัง`, `ทนดู`, ...) with **no English endurance word** in the source;
- a pronoun glued to `ทัน` + Thai letter (`ฉันทัน...`) with **no timing word** in the source;
- `ทนทาน` (durable) and honest endure/timing sources are left alone.

Wired into `CommonTranslator._is_glitched` so the existing repeat re-asks only that segment, with a retry note
telling the model not to add filler.

## Evidence

- Unit tests: flags both live variants; keeps `I ENDURED IT FOR A LONG TIME`, `I CANT STAND IT ANYMORE`,
  `I SAW IT IN TIME...` and `วัสดุนี้ทนทานมาก`.
- Mocked translator: a first answer containing `ฉันทัน...` is re-asked once and the corrected answer is returned.
- 3 live reruns of the Tsuki p1 page that used to leak `ฉันทนฟัง`: **0 spurious lines, 0 false re-asks**; the
  page's `I HEARD...` line now reads `ฉันได้ยินบทสนทนาของเธอกับเทพธิดา`.
- Full suite **902 passed**.

## Companion gate refinement (#990)

The same audit surfaced a gate false positive: `IT WONT KILL ME?!` -> `มันจะฆ่าข้าไม่ได้งั้นเหรอ?` was flagged as
a dropped `!`. A Thai rhetorical question keeps only the `?`, so the gate now accepts `?` as covering a dropped
`!` (symmetric to the earlier interrobang rule). Gate tests: 10 green.