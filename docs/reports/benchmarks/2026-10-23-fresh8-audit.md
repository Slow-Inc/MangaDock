# Fresh 8-page audit (un-audited set): guard caught a CJK leak, gate question-marker widened, no new deterministic class

- **Date:** 2026-10-23 · new pages never audited before: Kumo p0, Lv2 Cheat p0, Mushoku Tensei p0, Anta p0,
  Ki ni Natteru p0, Maou no Ore p0, Osoraku p0, Taida p0.

## Guard

`MIT_LOG_GLITCH=1` recorded **1 true-positive trigger**:

`AFTER PASSING AWAY...` -> `...เกิดขึ้น接连ไม่หยุด` (Chinese leak) — the segment was re-asked and the shipped
output is clean (`...เกิดขึ้นซ้ำแล้วซ้ำเล่า`). This is the #903 guard working on live traffic.

## Gate

Initially 2 `dropped_?` on the Maou page: `...คืออะไร` and `...หรือไง`. Both are Thai question forms where the
marker is **not at the very end**, so the gate's `$`-anchored rule missed them. Widened to look for the marker in
the final 16 characters and to include `อะไร / ทำไม / ยังไง / เท่าไหร่ / แค่ไหน`; re-gate of the 8 pages:
**0 violations on all 8**. Gate tests 12 green.

## Judge audit (53 segments)

Raw mean **1.43/2** (26 perfect / 24 minor / 3 broken). Triage: most flags are the judge's known typo noise (it
reports identical strings as misspelled); the genuine meaning flags are the **fragment class** — source cuts like
`ITS..`, `IN AN..`, `UNO?!` (stuttered `U…no?!`), trailing `S` — where the model commits to an unrelated word
(`มาน`, `ว่ายังไง`, `ลง`). That class has no deterministic licence (the model's choice is semantically wrong but not
rule-detectable from the strings alone), so it is recorded as a known limitation rather than guarded.

## Housekeeping

The D: drive filled up mid-round (`No space left on device` while saving a render). Removed the **2,722 regenerable**
`*.rendered.png` / `*.doctor.png` files under `MIT/result` (4.36 GB); all `*.doctor.json` evidence and the corpus
inputs are kept.