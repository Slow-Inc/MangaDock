# Final full-corpus sweep: 39/39 pages, 9 guard saves, 0 leftover defects

- **Date:** 2026-10-23 · every corpus page (`MIT/result/corpus*`), current defaults, `MIT_LOG_GLITCH=1`, gate,
  `--no-png`. Real gateway, GPU1.

## Guard activity and outcomes

| trigger | count | leftover after retries |
|---|---|---|
| `foreign_script` (CJK/Cyrillic/Arabic leaks) | 3 | **0** |
| `content_loss` (far-too-short answers) | 3 | **0** |
| `untranslated_word` (English kept inside Thai) | 2 | **0** |
| `dropped_question` | 1 | **0** |
| **total** | **9 triggers over 39 pages** | **0 leftovers** |

A post-run scan of all 39 final payloads with the four predicates found **zero** remaining instances: every
triggered segment was re-asked and fixed in place. That is the deterministic proof the guards work on natural
traffic, complementing the forced-injection harnesses.

## Gate

**2 violations over 39 pages:**

1. `dropped_!` on Iruma p1 #7 (`ที-ที่ฉันหมายถึงไม่ใช่แบบนั้น`) — the source exclamation is not carried; a minor
   nuance loss (the class is reported, not auto-fixed).
2. `inconsistent_name: TSUKUYOMI` (`ทสึกุโยมิ` vs `จิคุโยมิ`) — expected in these runs: `doctor_page` sends **no**
   `series_context`, so the series name memory is a strict no-op. On the production path the context is present
   (verified end-to-end) and a live two-page run kept one spelling.

## Latency

39 pages: wall **avg 7.65 s**, median **6.96 s** (warm), on GPU1 — consistent with the loop's 8-page profile
(8.98 s avg earlier, which included cold starts).

## Takeaway

The final default configuration processes the whole corpus with no deterministic quality violations beyond one minor
punctuation nuance and the context-dependent name case, while the guards correct 9 natural defects during the run
and leave nothing behind.