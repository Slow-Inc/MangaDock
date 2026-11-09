# Live guard sweep (10 real pages): guards fire, gate refines, name-consistency needs chapter grouping

- **Date:** 2026-10-23 · `MIT_LOG_GLITCH=1`, `--tag _guard21`, 10 real EN pages, HEAD after the round-83 trigger fix.

## Guards

| metric | value |
|---|---|
| glitch triggers | **2** (both `spurious_filler`, Dungeon p0) |
| trigger pairs | `IVE BEEN KILLED BY IT SO MANY TIMES...` -> `ฉันทนมันมาหลายครั้งแล่ว...`; `THIS IS HOW I DRAIN THE BLOOD...` -> `นี่แหละว่่าวิธีที่ฉันทนอยู่...` |
| final output of those lines | retried (different from the flagged candidate): `มันฆ่าฉันทับทายนับครั้งไม่ถ้วน...`, `นี่คือวิธีที่ฉันทดเลือดในกาย...` |

Both triggers are **true positives** (broken Thai the model produced). The retry removed the hallucinated `ทน`, though the replacement on the second line is still model-imperfect (`ทดเลือด` for "drain the blood") — the guard's job is to catch the measured filler pattern, not to guarantee a perfect rewrite.

## Gate

The sweep initially reported 6 violations across the mixed-series batch. Triage:

| flag | verdict |
|---|---|
| `added_latin` x3 (Chainsaw credits: `แปลโดย DALE`, `จัดหน้าโดย RTSD, ZERO`) | **false positive** — Latin names that are present in the source are legitimate; rule refined to compare tokens with the source |
| `inconsistent_name` (`HEHE` -> `เขะ` vs `ฮิฮิ`) | **tool misuse** — name consistency compares pages of one chapter; the sweep passed pages from different series in one call |
| `dropped_?` x2 (Boku p1 `YKNOW?` -> `นะ!`, `...?` -> `นะ!`) | known benign Thai rhetorical style (documented earlier) |

After the `added_latin` refinement, gating each page separately: **9/10 clean**, the only page with flags is Boku p1 with the two documented style cases.

## Follow-ups

- Gate usage note: run name consistency per chapter (group pages by series), never across a mixed batch.
- The retry log line (`Repeating because of invalid translation`) did not appear in the doctor log even though the
  outputs changed — the warning is emitted on the translator logger, which the doctor's handler does not capture.
  Not worth changing the logging config for; the env-gated `[glitch]` line is the diagnostic that matters.