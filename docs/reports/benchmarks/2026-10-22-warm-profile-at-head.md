# Warm profile at HEAD — translation is now the wall, and why the obvious overlap does not work

- **Date:** 2026-10-22 · **Method:** `doctor_page.py` with several pages in ONE process (models loaded once),
  live gateway, plus an instrumented counter around `CustomOpenAiTranslator._request_translation`.
- **Context:** the quality loop shipped #884 (OCR cuDNN-off), #882/#885/#886/#887 guards; this records where the
  remaining time goes before any further speed work.

## Warm pages (single process, stage ms)

| page | wall | detection | ocr | merge | translation | mask | inpaint | render |
|---|---|---|---|---|---|---|---|---|
| Dungeon p1 | 3903 | 418 | 872 | 522 | 1742 | 68 | 108 | 106 |
| Boku p1 | 4127 | 444 | 628 | 466 | 2163 | 90 | 168 | 87 |
| Taida p1 | 4572* | 523 | 708 | 333 | 1939 | 193 | 475 | 191 |
| Mieruko p1 | 6260 | 422 | 755 | 182 | **4224** | 176 | 225 | 130 |
| Osoraku p1 | 7090 | 661 | 197 | 626 | **4035** | 220 | 596 | 338 |

(*the 10611/7090 rows before the cache warmed include the per-process first-page detection cost; the steady
range is ~3.9-6.3 s per page on this host.)

## What the counter showed

**Exactly one gateway request per page** (4 pages → calls 1,2,3,4), no retries: the page-level Thai-ratio
retry never fired on these pages, so translation time is one round trip (1.7-4.1 s) and it is the single
largest stage — 45-60 % of wall.

## Ideas examined and rejected

| idea | finding |
|---|---|
| overlap mask_refinement + inpainting with the translation call | **Not safe:** the mask must be built from the POST-translation region list — dropped regions (#882 art glyphs, #887 phantoms, junk drops) must never be inpainted, otherwise the art they were kept for is erased. The 0.3-0.8 s overlap would change behaviour, not just timing. |
| OCR `max_chunk_size` 16 -> 32 | OCR 904/872/628 -> 859/689/552 ms on the same pages (5-20 %, inside the run-to-run noise, and chunk-size changes have previously altered reads at 64). Not worth a read-risk A/B. Reverted. |
| panel-detection downscale (round 22) | 406 ms -> 320 ms at 1200 px but 1/39 reading orders change. Rejected. |
| disable the gateway's thinking mode | already a measured no-op on this gateway (#631 note in `custom_openai.py`). |

## Where latency stands

Per page warm: **pipeline ~1.5-2.0 s** (detection ~0.4-0.7, OCR ~0.2-0.9, merge ~0.2-0.6, mask ~0.1-0.2,
inpaint ~0.1-0.8, render ~0.1-0.4) + **gateway 1.7-4.1 s**. The next real levers are quality trades
(detection resolution, OCR model size) or cross-page pipelining in the Backend (page B pipelines while page A
waits on the gateway) — both are decisions beyond a single-page pipeline change.
