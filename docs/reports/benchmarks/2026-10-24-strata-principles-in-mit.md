# Strata principles applied to MIT (2026-10-24)

Strata (`D:/Github/Strata`) is a local LLM inference engine tuned for latency on a two-card PC. Its ideas map onto MIT's
pipeline; this note records which ones transfer, what was measured, and what is deliberately not applicable.

| Strata principle | MIT equivalent | status |
|---|---|---|
| **Hot/cold memory placement**: hot experts in VRAM, all experts in RAM, CPU+GPU compute concurrently | `MIT_PRELOAD=1` loads every default-pipeline NN model at boot; models never unload (`models_ttl=0`) | **done** — idle VRAM ~4.9 GB on the worker card; first-page detection 5.6 s cold -> 0.75 s warm |
| **VRAM elastic / fits what you have** | single worker fits in ~5 GB; two workers = ~10 GB (or one per card) | **done** (preload) |
| **Batch slots / several conversations at once** | MIT front server accepts multiple registered workers; each worker handles one page at a time | **measured, opt-in** (below) |
| **Two-card split (cards work on different conversations)** | one worker per GPU, both registered to the same front (`--report http://127.0.0.1:<front>`) | **measured, opt-in** |
| **CPU and GPU overlap** | with two workers, one page's CPU stages (merge/mask/render) run while the other page is in remote translation | falls out of multi-worker |
| **Prompt / message-boundary cache** | repeated static system prompt + chat samples per page; a local engine with prefix cache (Strata) or provider-side prompt caching would make prefill nearly free | **candidate**: only worth it when MIT calls a local Strata endpoint |
| **MTP speculative decode / prompt cache** | apply to a local LLM engine; MIT translates through OpenCode Go (remote) | **not pursued** - MIT stays on OpenCode Go (2026-10-25); a local engine needs both cards + ~24 GB RAM alongside MIT's ~5 GB |
| **KV streaming / expert-cache adaptation** | no KV cache on the vision models; panel detection (Kumiko) has no cache to reuse | n/a |
| **Latency-oriented telemetry** | MIT already logs per-stage `elapsed_ms` (and the doctor/dashboard aggregate them) | in use |

## Experiment: batch slots via a second worker

Two pages of one chapter, same config, `OpenCode Go / deepseek-v4.1-flash`: one page is long (translation ~14 s), one short.

| setup | concurrent 2 pages | sequential 2 pages | gain |
|---|---|---|---|
| 2 workers, same GPU | **24.7 s** | 33.0 s | **1.34x** |
| 2 workers, one per GPU (5060 Ti + 4070 SUPER) | **25.3 s** | 30.1 s | 1.19x |
| 1 worker (implied by sequential) | - | 30.1-33.0 s | - |

The gain is bounded by the **remote translation latency**, not by MIT: two concurrent translation calls to the same
gateway slow each other, so the second page cannot finish in parallel for free. On this workload the result is ~15-35 %
more chapter throughput for concurrent requests, with identical per-page quality (same code/config/models).

### How to run MIT with two workers

```powershell
# 1) front server as usual (it starts worker #1 with --start-instance)
cd D:/Github/worktrees/mit-quality/MIT
$env:CUDA_VISIBLE_DEVICES='1'; $env:MIT_PRELOAD='1'
D:/Github/MangaDock/MIT/.venv/Scripts/python.exe -u server/main.py --host 0.0.0.0 --port 5003 --use-gpu --start-instance

# 2) extra worker, second GPU, registers itself to the front
$env:CUDA_VISIBLE_DEVICES='0'
D:/Github/MangaDock/MIT/.venv/Scripts/python.exe -m manga_translator shared --host 127.0.0.1 --port 5005 --use-gpu --report http://127.0.0.1:5003

# 3) /health now reports workers: 2; requests are dispatched to free workers automatically
```

When to use it: chapter/batch workloads with concurrent page requests. Leave it off for single-page use (one worker keeps
VRAM free for the display/other apps).

## Not pursued: wiring MIT to Strata itself

MIT's translation stays on **OpenCode Go** (remote, 10-16 s/page; everything else in the pipeline is ~3-5 s).
MIT is not wired to a local Strata engine: that would need both cards and ~24 GB RAM for the 125B model alongside MIT's
~5 GB of vision models, and it is a product decision to keep the gateway path. This note is kept as the record of which
Strata principles did transfer (hot-model preload, batch-slot workers) and the measurements behind them.