# ADR 034 — MIT dual-GPU serving: worker layout over a new engine, Strata as reference design

- Status: Accepted, 2026-10-25 (#1119). Evidence: [benchmark report](../reports/benchmarks/2026-10-25-mit-dual-gpu-throughput.md).
- Scope: MIT front/worker serving on the dev/serving PC (RTX 5060 Ti 16 GB + RTX 4070 SUPER 12 GB, 48 GB RAM).

## Context

The goal was to use both GPUs at full efficiency and cut batch and single-page time, researching Strata-xeno as
the engine. Tracing one page: GPU stages 2–3 s, the remote LLM call ~10 s (long tail from reasoning runaways),
plus 2.5–13 s lost moving the result from worker to front (`StreamingResponse(io.BytesIO(...))`, fixed in
`MIT/manga_translator/mode/share.py`). The gateway serves 8 concurrent calls about as fast as one.

## Decision

1. **Scale batch throughput with more worker processes spread over both cards**, not a new engine:
   `MIT_WORKERS=5`, `MIT_WORKER_GPUS=1,1,1,0,0` (4.36 s/page on the 10-page corpus, 10/10), or 4 workers when the
   display card is busy. Dispatch picks the free worker on the least-busy GPU (`MIT/server/worker_plan.py`
   `pick_free_worker`). The worker knobs land with PR #1118 and the dispatch with its stacked PR; on `main` today
   MIT runs one worker.
2. **Strata-xeno is a reference design, not MIT's runtime.** Its engine runs one MoE LLM (C++/CUDA); it cannot run
   MIT's PyTorch vision stages, and as MIT's translator it does not fit beside a multi-worker MIT on this PC
   (12.9 GB RAM free with MIT up vs Strata's ~23.7 GiB working set, per its README) and decodes slower than the
   current gateway (51–72 tok/s per Strata's README vs ~85–100 tok/s measured). MIT adopts its serving ideas:
   replicas behind one front, lowest-load routing, several requests in flight.
3. **No translation hedging; `reasoning_effort=none` opt-in only.** Hedging was measured and rejected. `none` was first
   misjudged (the value never reached the gateway); once it did: 0 reasoning tokens and ~2.3–4.8 s per call, but a blind
   A/B prefers `low` 76:46, so `low` stays the default (report, Corrections).
4. **Chapter batches run one page per worker** when pages are independent (rolling context off) — Strata's batch-slot
   rule; 4 workers is the live layout because 5 did not beat it on the Backend's chapter path.

## Alternatives considered

- **Strata as translator** — rejected for this PC (memory, speed above). Revisit on a machine with spare RAM or
  if a faster local model appears.
- **Hedged translation request** — slower in 2/2 sequential pairs; removed.
- **In-worker batch slots sharing one model copy** — would lift the VRAM cap on worker count; deferred (core-seam
  work, gain bounded by the slowest page once ~5 pages are in flight).
- **Speculative mask/inpaint overlapped with translation** — the post-translation region filter decides the mask
  (`MIT/manga_translator/manga_translator.py` region filter before mask refinement); deferred.

## Consequences

- Batch speed now scales with VRAM (≈ 4.6 GB per worker, ≈ 4.6 GB private RAM each); GPU mean util stays low
  (10–11 %) because GPU work is short. "Full efficiency" means both cards serve pages concurrently.
- Single-page latency is bounded by the LLM call; further gains need a faster model or the deferred overlaps.
- Five workers leave ~0.8 GB VRAM on the display card.

## Update (2026-10-25, later): one process per card with slots

Measured after the fixes above (claude-haiku translation, 10-page Backend chapter path): 4 single-slot workers reach
**38.1 GB** private memory after a run; **2 workers (one per card) × 5 slots** (`MIT_WORKERS=2`, `MIT_WORKER_GPUS=1,0`,
`MIT_WORKER_SLOTS=5`, PR #1128) run the chapter in the same time with **22.4 GB**, and avoid same-card CUDA-context
contention (3 workers on one card slowed detection 2.5×). A FIFO lock over detect/OCR inside a worker lets the first
pages reach the LLM at ~2 s instead of ~12 s. This supersedes the "4–5 workers" layout in Decision 1 for this PC.
