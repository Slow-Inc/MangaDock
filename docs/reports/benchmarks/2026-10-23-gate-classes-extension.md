# Gate now covers the newer guard classes (content loss, untranslated word) and the dashboard over stored pages

- **Date:** 2026-10-23 · `manga_translator/quality_gate.py`, tests.

## Change

`check_page` now also flags:

- **`content_loss`** (`content_loss` predicate: Thai answer far shorter than an English source of >= 24 chars),
- **`untranslated_word`** (`untranslated_source_word`: a source word kept in Latin inside a mostly-Thai answer).

These were live retry triggers; the deterministic chapter gate should see the same classes, so a replay can report
them without the judge.

## Dashboard over the latest stored page output (44 payloads)

**2 violations:**

1. `content_loss` on an old audit payload (`114 -> 46` chars) — exactly the class the predicate targets.
2. `dropped_!` on Iruma p1 (`ที-ที่ฉันหมายถึงไม่ใช่แบบนั้น`) — the known minor nuance (the source exclamation is not
   carried; the class is reported, not auto-fixed).

No `untranslated_word` remains in the stored outputs, and the other gate classes stay clean. Tests added for both
new rules.