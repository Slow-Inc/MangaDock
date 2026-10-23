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