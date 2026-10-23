# Forced-guard verification: the filler and LOST->หายาก guards fire and fix live output (#1039, #1052)

- **Date:** 2026-10-23 · tool: `tools/forced_guard_bench.py` · page: Otome p0 (has `LOST ITEMS.` lines), real
  gateway, GPU.

## Method

Forced-failure harness: on the first translation response it replaces one prompt line's answer with a known-bad
translation, then runs the real pipeline and checks (a) how many translation requests were made and (b) whether the
final payload still contains the bad pattern.

| pattern | injected answer | requests | bad pattern left | final LOST lines |
|---|---|---|---|---|
| lost (#1052) | `ของหายาก` for a `LOST` line | **2** (retry) | **none** | `ไอเทมที่สูญหาย` / `เทคโนโลยีที่สูญหาย` |
| filler (#1039) | `ฉันทันทำแบบนั้น` | **2** (retry) | **none** | clean |

## Verdict

Both guards are live: the injected defect is detected, the segment is re-asked, and the shipped page contains no
occurrence of the bad pattern. This closes the behavioural acceptance item of #1039 and #1052 (previously only
mocked/golden evidence; natural triggers are intermittent, so this is the only reproducible live proof).

Cost: one extra translation request only on a page whose answer trips a guard.