# #905 worker HTTP path: structurally correct, but today's timings are host-load noise

- **Date:** 2026-10-22 · **Issue:** #905 · **Environment note:** CPU load **84 %**, RAM free dropped to ~7 GB at peak,
  GPU1 idle 0 % after stopping the test worker.

## What was verified (real worker process, HTTP)

Started a standalone worker (`MangaTranslatorShared` on 127.0.0.1:5123, GPU1) and drove it over HTTP:

| arm | wall (4 pages) | per page |
|---|---|---|
| sequential `POST /simple_execute/translate_patches` x4 | 45.61 s | 11.40 s |
| `POST /simple_execute/translate_batch_pipeline` (one request) | 50.18 s | 12.55 s |
| speedup | **0.91×** | |

**Structural parity held**: patches 10/5/4/8, regions 17/15/30/12 and page sizes identical between the two arms
(the batch endpoint and client/worker plumbing work end-to-end).

## Why the timing is not a verdict

- The same in-process A/B that measured **1.37×** earlier in the day (round 42, quiet host) re-measured
  **1.06×** and then **1.02×** during this round, with **per-page wall rising 6.58 s -> 9.2 s** on the same pages and
  config. Host CPU load is 84 % (other desktop/agent processes), and the CPU-side pipeline phases (numpy/image
  ops, PNG encode) are what the overlap cannot hide.
- One transient `numpy` allocation failure (60 MiB) in the worker under RAM pressure — the batch path holds two
  pages of context, so peak host memory is higher than serial. Worth watching for production batches.

## Conclusion / next

The plumbing is correct and stays **opt-in** (`MIT_BATCH_PIPELINE`, default off). The production verdict needs a
quiet machine: retest with CPU load <20 % (record `nvidia-smi` + CPU before/after), 9-page chapter, and then decide
on the default. No code change from this round beyond the already-committed wiring.