# Translation latency levers measured: cap tuning is a dead end, bounded concurrency is real (K=2-3)

- **Date:** 2026-10-22 · **Issue:** #904 · **Method:** direct `CustomOpenAiTranslator.translate` calls (production prompt/config), wall-clock timing, output integrity checks.

## 1. Completion-token cap (no change)

`CUSTOM_OPENAI_MAX_COMPLETION_TOKENS` 4096 (current) / 8192 / 1024 on the same 4 pages:

| cap | calls | per call | empty/truncated outputs |
|---|---|---|---|
| 4096 | 6 | 2.5-3.3 s | 0 |
| 8192 | 4 | 2.9-4.1 s | 0 |
| 1024 | 5 | **3.7-4.4 s** | 0 (these pages) |

The 9arm gateway emits reasoning regardless of the disable levers (documented in `custom_openai.py`), so a smaller cap does not save time and risks #623's dense-page empty content. The current 4096 stays.

## 2. Concurrency scales — then breaks at K=5

| test | sequential | concurrent | result |
|---|---|---|---|
| 3 pages | 9.39 s | **5.22 s (K=3)** | **1.80x**, 0 empty |
| 5 pages | 13.62 s | 3.37 s for 2 pages (K=2) / 4.12 s for 3 (K=3) | ~2x effective |
| 5 pages | — | **44.8 s (K=5)**, two calls timed out and retried | gateway chokes |

Per-call latency inflates only 10-45 % at K=2-3. Single-page latency is unaffected — this is a **chapter throughput** win, and pages are currently translated serially.

## Design sketch (issue #904)

- Backend batch job: bounded concurrency K=2-3 (`MIT_BATCH_CONCURRENCY`, default 2), preserving page ordering and patch-cache keys.
- MIT server: overlap page N+1's async translation with page N's GPU stages (serialize GPU stages only; naive page parallelism would contend on VRAM at detection 2560).
- Verify: chapter wall time at K=2 at least 30 % lower, no timeout retries, peak VRAM +10 % max, translations unchanged per page.

## Why this is the right lever now

Warm profile at HEAD: translation 1.6-5.4 s (39-63 % of wall), non-translation 2.3-3.0 s (detection 0.45, OCR 1.0-1.6, merge 0.2-0.6, mask 0.25, inpaint 0.3, render 0.2). The GPU-side stages are already optimised in this loop; the open speed win is overlapping the gateway wait across pages.