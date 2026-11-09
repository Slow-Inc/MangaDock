# #905 slice 1 — the pipelined batch loop, unit-tested, 1.69× in simulation

- **Date:** 2026-10-22 · **Issue:** #905 · **File:** `server/batch_pipeline.py` (+ `test/test_batch_pipeline.py`).

## What was built

`run_pipelined(pages, prepare_front=..., translate=..., finish_back=..., cancel_check=...)` — a two-slot
cross-page pipeline:

- translation stays **strictly ordered** and chains the #159 rolling context (`translate(front, prev_context)`,
  `prev_context = result['block']`), so the name/pronoun consistency feature is untouched;
- page *i+1*'s **front** stages (detect/ocr/merge) are started **before** page *i*'s translation awaits, so they
  overlap the gateway wait;
- page *i*'s **back** stages (mask/inpaint/render) run concurrently with page *i+1*'s translation;
- cancellation is polled between pages (a cancel stops new translations; an already-prefetched front stage may be
  in flight and is cancelled);
- results come back in page order.

The heavy work is injected, so the ordering/overlap/cancellation logic is testable without the ML stack — the
same property `server/batch_runner.py` is designed around (Issue #100).

## Evidence

| check | result |
|---|---|
| unit tests (`test/test_batch_pipeline.py`) | **5 passed** — page order, strict translation order + context chaining, front(i+1) starts before translate(i) ends, cancellation semantics, stage failure propagation |
| simulation with warm-profile numbers (front 2.05 s, translate 3.2 s, back 0.75 s, 8 pages) | sequential 48.2 s -> pipelined **28.5 s = 1.69×**; ceiling 1.88×; results in order |

## What remains for #905

1. Worker task type (`batch_pipeline`) that runs this loop inside the worker process where the stage functions
   live — the API/batch_runner side then submits it instead of N single-page tasks.
2. Real chapter A/B: 9-page chapter at K=2 pipeline, byte-identical patches/prompts/context, peak VRAM flat,
   cancellation and per-page webhooks intact.
