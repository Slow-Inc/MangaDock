# OCR re-read extended to single-letter function-word garbles (`N` = NOT)

- **Date:** 2026-10-23 · `ocr_reread.py` (part of the default-ON second pass).

## The defect

A v6 zero-score segment: OCR read `AH-DO YOU N LIKE THESE SNACKS?` (the `NOT` was mangled to a lone `N`), so the
translator produced a positive question and the negation was silently lost. The line's OCR confidence was 0.78 — above
the 0.75 re-read threshold — so the normal second pass skipped it.

## Fix

- A standalone capital letter that is not `I`/`A` between words (`_SUSPICIOUS_SINGLE`) marks the line as a re-read
  candidate regardless of confidence.
- `better_read` also accepts a correction that **removes** the suspicious token even when the confidence score does not
  improve (the re-read read `NOT` at 0.68 vs the garbled line's 0.78, but the text is right).

## Evidence (3/3 independent runs on the Iruma page)

```
[ocr-reread] 'YOU N' (0.78) -> 'YOU NOT' (0.68)
shipped OCR: AH- DO YOU NOT LIKE THESE SNACKS?
shipped Thai: อ๋อ- เธอไม่ชอบขนมพวกนี้หรอ?   (negation preserved)
```

Before the change the same page shipped `อ- เธอชอบขนมพวกนี้มั้ย?` (positive). Tests added in
`test_ocr_reread.py`; no new flag (still part of `MIT_OCR_REREAD=0`-controllable pass).
## Follow-up: never swap one garble for another (round 241)

Re-running the five pages that had suspicious singles showed the expected Iruma fix (`YOU N` -> `YOU NOT`) and one
worthless churn: `TREASURE DOWN HERE S` (0.29) was re-read as `TREASURE DOWN HERE F` (0.54) and accepted through the
**confidence margin** path, i.e. garbled to garbled. `better_read` now returns early for a suspicious old line: the only
acceptable outcome is a read with **no** suspicious single left. Test added; suite 984 passed.
## Wider crop for suspicious lines (round 242)

Suspicious lines are re-read with a 1.7x wider padded box (0.51 of the line instead of 0.30): the missing letter is
often just outside the detector box, and `better_read` only accepts a read that removes the garble anyway.
Measured on the Iruma page: the same corrections are found with a much better confidence (`YOU N` -> `YOU NOT` at
**0.95** vs 0.68; `AH- DO` at 0.91 vs 0.82); the Osoraku line still cannot be recovered (`DOWN HERE S`, accepted 0), and
both pages keep gate 0. Test asserts the suspicious crop is wider; suite 985 passed.