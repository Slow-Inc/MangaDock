# #905 — `translate_batch_pipelined` on 6 real pages: 1.37× wall time, identical structure

- **Date:** 2026-10-22 · **Issue:** #905 · **Files:** `manga_translator.py` (`translate_batch_pipelined`),
  `test/test_batch_pipelined_translator.py`.

## What it does

Runs a batch of pages through the same three phases `translate_patches` uses — front (detect/ocr/merge), the
ordered translation, back (mask/inpaint/render) — but schedules them so page i+1's **front** starts during page
i's translation wait and page i's **back** runs during page i+1's translation. Translation order stays
i -> i+1, so the #159 rolling context keeps working when `MIT_CONTEXT_PAGES > 0`; with the default (0) the
batch is page-independent and the overlap is free.

## Real measurement (one process, models warm, tuned config)

| arm | wall | per page |
|---|---|---|
| sequential `translate_patches` x6 | 39.49 s | 6.58 s |
| **`translate_batch_pipelined` x6** | **28.91 s** | **4.82 s** |
| speedup | | **1.37x** |

Structural parity (all 6 pages): patches 10/5/4/8/6/7 identical between arms, regions 17/15/30/12/7/13 identical,
page sizes identical. Prompts/config/context untouched — only the schedule changed.

## Tests

- `test_batch_pipelined_translator.py`: each page goes through front -> translate -> back in order; a page with no
  regions skips translation and returns the empty patch result. (Heavy: imports the pipeline.)
- Existing `server/batch_pipeline` loop tests (5) cover ordering, overlap, cancellation and failure propagation.

## Remaining for #905

1. Worker endpoint + `batch_runner` submission behind an env flag (the API/queue path still sends one page per
   task), so production chapters get the 1.37x instead of only in-process callers.
2. Production chapter A/B with webhooks/cancellation and peak-VRAM check, then the on-by-default decision.
