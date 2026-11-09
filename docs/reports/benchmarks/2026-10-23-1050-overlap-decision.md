# #1050 decision — the overlap already exists at page granularity (#905); in-page threading rejected

- **Date:** 2026-10-23 · relates: #905 (batch pipeline), #1051 (now default ON), #1050.

## The opportunity measured in this loop

`mask_refinement + inpainting` **0.70 s/page** on average (max 1.30 s) and does not depend on the translated text,
so on the single-page path it is serialised behind the gateway wait for no dependency reason (#1050).

## What already covers it

`server/batch_pipeline.py` (`run_pipelined`) starts page **i+1's front** before page i's translation and runs page
**i's back stages (mask/inpaint/render) concurrently with page i+1's translation** — exactly the overlap at chapter
granularity (measured earlier: 1.37x in-process, 1.16x over worker HTTP on a loaded host). #1051 (default ON this
round) also removed the region-list instability that originally blocked a single-page version.

## Why not implement in-page threading now

1. **It would be redundant for chapters:** the batch path already overlaps the whole back half of a page with the
   next page's translation; the in-page version only helps a client that sends pages one by one.
2. **Risk:** the back stages touch the GPU (`_run_inpainting`, model unloaders, the selective-Flux lock). Running
   them in a worker thread while the event loop awaits the gateway needs a second event loop plus thread-safe
   model loading/unloading — a reliability risk for a ~0.5-0.9 s/page gain on one path, exactly the class of change
   this loop avoids shipping without proof.
3. **The batch path is already the intended lever**, and it carries the quality wins (cross-page context and the
   name glossary) as well. Its tradeoff is UX (no live per-page progress) and higher peak memory, so it stays
   opt-in (`MIT_BATCH_PIPELINE=1`).

## Recommended next step for throughput

Enable the batch pipeline for chapter jobs where per-page live progress is not required, and revisit the default
once the Backend's progress UX no longer depends on per-page callbacks. The single-page latency levers that remain
are covered by the preload flag (#1047) and the filter move (#1051).

Closing #1050 as superseded by #905 (+ #1051 for the precondition), with this rationale.