# GPU inventory + which card the loop tests on (RTX 5060 Ti 16 GB vs RTX 4070 SUPER 12 GB)

- **Date:** 2026-10-22 · **Host:** one machine, both cards idle outside these tests.

| GPU | model | VRAM | used by this quality loop? |
|---|---|---|---|
| 0 | **NVIDIA GeForce RTX 4070 SUPER** | 12,282 MiB | **no** (was idle until this measurement) |
| 1 | **NVIDIA GeForce RTX 5060 Ti** | 16,311 MiB | **yes** — every doctor/A-B/worker run uses `CUDA_VISIBLE_DEVICES=1` |

## Does the pipeline fit both? Yes

Production config (detection 2560, LaMa inpaint, OCR cuDNN off), real pages:

| card | peak torch alloc | peak reserved | note |
|---|---|---|---|
| 4070 SUPER | 2,604 MiB | 3,250 MiB | fits easily in 12 GB |
| 5060 Ti | 2,606 MiB | 4,100 MiB | fits in 16 GB with more headroom |

## Speed: same class, differences inside run-to-run noise

Replayed translations (GPU-compute only; each process cold-loads models, so detection ~5.0-5.5 s includes the
load):

| page | 4070S wall | 5060Ti wall | detection | OCR | inpaint | render |
|---|---|---|---|---|---|---|
| Boku p0 | 13.07 s | 14.84 s | 5.22 vs 5.53 | 1.52 vs 2.26 | 0.34 vs 0.46 | 1.60 vs 2.32 |
| Mieruko p0 | 16.17 s | 14.11 s | 5.30 vs 5.20 | 3.22 vs 2.50 | 0.55 vs 0.56 | 4.04 vs 3.01 |
| Horimiya p0 | 13.59 s | 14.81 s | 5.00 vs 5.53 | 2.58 vs 2.74 | 0.39 vs 0.64 | 1.85 vs 2.03 |

The 4070 SUPER is marginally ahead on detection/rendering in this sample; the 5060 Ti wins some OCR runs. No
stage is decisively faster on this workload, and translation (the dominant phase) is gateway-bound and unaffected.

## Recommendation

- Keep the loop and any production worker on the **RTX 5060 Ti 16 GB**: same speed class plus the VRAM headroom
  the batch pipeline needs (two page contexts) and for future concurrency.
- The 4070 SUPER is a valid single-page worker if a second one is ever needed; it also frees the 5060 Ti for the
  quality loop.