# Baseline sweep 46: guard trigger triage, two false positives fixed, content-loss class measured (#1056/#990/#1058)

- **Date:** 2026-10-23 · 8 real pages, current defaults (all guards), `MIT_LOG_GLITCH=1`, gate, judge.

## Sweep

- **7 triggers / 8 pages** — all true positives: CJK `算了`, Arabic `قوية`, Cyrillic `чит`, CJK `着` (foreign_script),
  two `lost_as_rare` (`LOST ITEMS.` -> `ของหายาก`), and one `Episode?3` (see FP below). Pages were chosen to include
  the known defect-rich set, so this is not the natural rate.
- **Judge: 92 segments, mean 1.48/2** (baseline 1.44-1.48). 5 zero-score flags: 3 are the judge's known
  typo-noise pattern (`ฉัน→ฉัน`), 1 a real fragment misread (`R.. RIGHT..` -> `อ.. ใ..ใจแล้ว`), 1 a shortened
  Horimiya line (content-loss class, below).

## False positives fixed

1. **`dropped_question` on `Episode?3`** (`ตอนที่ 3`): a `?` embedded between alphanumerics is OCR noise / title
   styling, not a question. The predicate now strips embedded `?` before deciding, with a test (`Episode?3`,
   `IF?YOU CAN` are not questions; `IS THAT SO?` still is).
2. **Gate `dropped_?` false violation** on a long Thai sentence whose question particle (`หรือที่...`) sat early:
   the check only searched the last 16 characters. It now searches the whole answer, with a test; re-running the
   gate over the same 8 sweep pages gives **0 violations** (was 1).

## New quality class: content loss (#1058)

Measured dst/src length ratio over **8,423 real segments** (all stored doctor runs): median **0.86**, p10 **0.66**,
and **54 segments (0.6 %)** below **0.45**. Spot checks in the tail show real loss, not terseness:
`MAY THE BLESSINGS OF THE GREAT` -> `ขอพรจากมหา` (truncated, 4 runs), `THE BUGS WARPED WITH 16 WARSHIPS…` ->
`แล้ว... สิ่งเลวร้ายที่สุดที่อาจเกิดขึ้นคืออะไร` (different content), `TELL... THE DEMON.. LORD..` -> `พริบตา`.

Added `content_loss(src, dst, to_lang)` (Thai target, ASCII source >= 24 chars, ratio < 0.45) and wired it as an
**opt-in** trigger (`MIT_CONTENT_LOSS_GUARD=1`) with a retry note asking for the whole line; tests cover the tail and
normal ratios. Forced-injection proof and a corpus sweep are the next step before any default decision.
## Content-loss guard: forced proof and default decision

- **Forced injection:** corrupted a long line's answer to `พริบตา` — `content_loss` fired, the translator re-asked
  (**2 requests**) and the final line was the full translation (`ลองคัดลอกแบบร่างตามที่โฮริจัดไว้ให้ดู`); the final
  payload had **0** content-loss regions.
- **A first run of the same harness exposed a real false-positive source:** on retries the query carries an appended
  `[note: ...]`, so the predicate's source length was inflated and already-retried segments flagged spuriously. The
  predicate now strips an appended note before measuring; a test pins it (a normal-length answer with a note is not
  loss, the truncated one still is).
- **False positives:** 13 pages with the flag on produced **0 triggers**, gate 0 violations (threshold is the deep
  tail: measured p10 ratio 0.66 vs the 0.45 cut).

**Decision: default ON** (`MIT_CONTENT_LOSS_GUARD=0` disables). It only acts on the measured loss tail, the retry
note asks for the whole line, and the forced proof shows the content restored. Trigger test pins the default; heavy
glitch suite 19 green.