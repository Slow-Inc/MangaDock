# `consider_as_please`: a measured semantic swap now gets a retry (#1040)

- **Date:** 2026-10-23 · predicate in `translation_quality.py`, wired into `_is_glitched` + retry note.

## The defect

The v4 judge audit flagged `CONSIDER BUYING THE OFFICIAL VOLUMES` -> `กรุณาซื้อ...` ('please buy'): CONSIDER is a soft
suggestion, แต่ `กรุณา` turns it into a request. Mined all stored runs for CONSIDER lines: 6 unique renderings, **2
were please-style** (`กรุณาซื้อ...`), 4 kept the suggestion.

## Fix

`consider_as_please(dst, query)` fires when the source says CONSIDER (and not PLEASE) while the Thai contains `กรุณา`
(and not `พิจารณา`). It is wired into the retry trigger and gets its own note: *"CONSIDER means พิจารณา / ลอง (a
suggestion), not a request. Do not use กรุณา here."*

## Evidence

Natural run on the Chainsaw credits page:

```
[glitch] consider_as_please | src='CONSIDER BUYING THE OFFICIAL VOLUMES' -> dst='กรุณาสนับสนุนด้วยการซื้อฉบับพิมพ์'
final shipped: ลองพิจารณาซื้อฉบับพิมพ์
```

The guard fired on the bad rendering and the re-ask produced the correct suggestion wording. Trigger test added
(`test_consider_as_please_is_reasked_1040`); full suite 967 passed.
## False-positive scan

Scanned **19,327 stored regions** across every doctor dir in the repo: the predicate fires exactly **2 times**, both the
known bad `CONSIDER BUYING ...` renderings — zero false positives on corpus.