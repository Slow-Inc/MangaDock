# Selective Flux repair: the two cost levers — measured, both opt-in (MIT_FLUX_WARM=0, MIT_FLUX_SIZE=0)

Adopting the selective Flux repair (2026-10-27-selective-flux-adopted.md) made the chapter ~3.3× slower. Two knobs
were tried against that cost, both measured on the same 14-page chapter.

## 1. Keep Flux resident across pages — `MIT_FLUX_WARM=1`

The per-page flow unloads LaMa, loads Flux, repairs, unloads Flux; the model load is repeated on every page that
has a text-over-art component. With `MIT_FLUX_WARM=1` neither face is unloaded (both stay in VRAM):

| arm | chapter wall (two runs) | failures |
|---|---|---|
| cold (per-page swap) | 173.1 / 172.7 s | — |
| warm | **154.7 / 158.8 s** | 0 OOM, 0 per-crop fallbacks, 28 repair passes with 1–2 regions |

≈9 % faster, and the logs confirm the model was never unloaded (0 `Unloading` lines). The saving is small because
most of the per-page cost is the Flux **inference**, not the load.

**Kept opt-in, not default:** warm needs LaMa and Flux resident together; on the 12 GB worker a heavier page could
OOM and fall back to per-crop inpainting (a quality regression), so a deployment that wants the 9 % opts in after
checking its free VRAM.

## 2. Repair at 1024 instead of the LaMa-sized 2048 — `MIT_FLUX_SIZE=1024`

Reasoning: the repair boxes are small, so a smaller working size should be enough and faster. Measured on the same
p2 (hand-lettered HUH over hair, the case the pass exists for):

| working size | p2 wall |
|---|---|
| 2048 | 27.6 s |
| 1024 | 29.5 s |

No speed-up at all (the model's own tiling dominates), and the repaired art looked equivalent in the side-by-side.
So the knob stays in the tree but is not used — `MIT_FLUX_SIZE=0` keeps the config size.

## What this means for the quality decision

The art repair stays on; its price is the Flux inference per affected page, and neither cheap lever moves that much.
The remaining options are product choices, not engineering ones: accept the cost, gate the pass on a larger minimum
art-box area, or run it as an offline chapter pass. All three are recorded here rather than shipped silently.
