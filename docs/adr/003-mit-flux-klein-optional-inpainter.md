# ADR 003 — Flux.2 Klein-4B (GGUF Q4) as an optional, VRAM-neutral inpainter

- **Status:** Accepted — **implemented** (2026-06-14). PRD **#272** slices **#273** (GPU-free foundations:
  `flux_embed_cache` + `flux_image_prep`) / **#274** (`FluxKleinInpainter` + `Inpainter.flux_klein` enum +
  `INPAINTERS` registry + guarded smoke) / **#275** (Backend `MIT_INPAINTER` + renderConfigHash bust) are
  landed and green; **#276** (full diverse-manga E2E + report) is in progress. Validated end-to-end on the
  One-Punch benchmark through the live Reader: ghost gone (the mask-tighten fix) **and** the painted band
  gone — the dark-hair region matches the MangaTranslator target (operator-confirmed "100%").
- **Context PRD:** #268 (VRAM-neutral band fix) · supersedes the classical-lever path of #269/#270/#271
- **Overturns:** ADR 002's blanket "Flux/diffusion inpainter — rejected, OOM on the 12 GB card"
- **Implements via:** the `OfflineInpainter` contract + `INPAINTERS` registry described in [ADR 009](009-mit-model-lifecycle-dispatch-registry-worker-guards.md); the byte-identical patch composite of [ADR 004](004-mit-patch-based-rendering-pipeline.md); the classical-lever ladder it sits above is [ADR 005](005-mit-classical-cpu-inpaint-refinement-levers.md).

## Context

The "painted band" (and its sibling, the mask-tighten "ghost") is the residue left where large
source Japanese text sat over **complex/dark art** (the hair on the One Punch-Man benchmark). The
band has **two** components: (A) a low-frequency **luminance** offset (~18 levels) and (B) a
**texture** difference — LaMa fills with a smooth patch where the original had hair strands.

ADR 002 + the three classical levers built on it were all tried and **measured on real data**:

| Lever | Result on the live page |
|---|---|
| Per-pixel luminance re-ground (ADR 002) | **146 → 154** — moved the wrong direction; image unchanged. Bottom-right is a hair→light *transition* zone, so the propagated surround is *lighter* and pulls hair lighter; and it can only touch (A), never (B). |
| `mask_tighten` (shrink mask to ink strokes) | band ↓ but **faint ghost of the original text everywhere** it sat — under-erases (worse than the band). |
| `seamless_clone` (Poisson) | no measurable effect on the band. |

**Conclusion: no VRAM-neutral *classical* method fixes the band cleanly** — only (A) is reachable
by luminance/blend math; (B) needs actual **texture reconstruction**, which is a diffusion model's
job. ADR 002's reground stays in the tree as default-off dead-weight; it is not the fix.

ADR 002 had rejected Flux on a single assumption — *"even the smallest quantised variant (~5–6 GB)
pushes the card to ~11–12 GB → OOM."* That assumption is **wrong for our use case**, because it
counted the 8 GB text-encoder as resident. Our removal prompt is **fixed** ("remove all text, keep
art"), so the encoder runs **once**, its embedding is cached, and it is dropped before the per-page
loop. A grounded probe (RTX 4070 SUPER, 12.88 GB) confirmed the real footprint:

| Measurement | Value |
|---|---|
| transformer Q4 (`unsloth/FLUX.2-klein-4B-GGUF`, Q4_K_M, 2.6 GB) resident | +2.87 GB |
| **peak VRAM per page, embed cached** | **5.8 GB** (7 GB headroom) |
| one-time encode spike (encoder CPU-offloaded) | 9.4 GB — fits |
| latency, Klein step-distilled (4 steps) | ~3–4 s/page steady (13.6 s first call incl. encode) |
| quality on the raw JP page | text + big ぬ SFX removed cleanly; **hair texture reconstructed — no band, no ghost** |

## Decision

Add **Flux.2 Klein-4B**, transformer quantised to **GGUF Q4**, as an **optional** MIT inpainter
(`Inpainter.flux_klein`, default OFF — LaMa-large stays the default). It plugs into the existing
`OfflineInpainter` contract (`_load`/`_infer`/`_unload`) and the registry, so the rest of the
pipeline is untouched. VRAM-neutrality comes from three levers, all proven by the probe:

1. **Cached prompt embedding.** Encode the fixed removal instruction once via the 8 GB VLM text
   encoder, persist the embedding to disk, then never load the encoder again in the steady loop.
   The per-page pass needs only the Q4 transformer (2.6 GB) + VAE (0.17 GB).
2. **Load/unload around the inpaint pass.** The Flux pipeline is loaded only for the inpaint step
   and unloaded after, so MIT's steady-state VRAM is unchanged — the user's hard constraint.
3. **Whole-page edit + patch composite.** Klein is instruction image-editing (no mask input). We
   run it on the page, then keep only the **text-region patches** via the existing blend
   `inpainted·mask + orig·(1−mask)`; every pixel outside the text mask stays **byte-identical
   original**, so whole-image drift from the edit is discarded and the #156 patch contract holds.

Backend exposes it via `MIT_INPAINTER=flux_klein`, folded into the render-config-hash so switching
inpainters busts the translated-patch cache (avoiding the stale-render gotcha).

## Alternatives considered

**Quant backend** (for the Q4 transformer):

| Backend | Verdict |
|---|---|
| **diffusers + GGUF Q4** (`GGUFQuantizationConfig`) | **chosen** — pip-only into MIT/.venv, native `Flux2KleinPipeline`, `enable_model_cpu_offload` for the one-time encode, load/unload trivial, no CUDA-wheel matching. Fewest moving parts (North Star). |
| nunchaku (INT4 SVDQuant) | fastest + lowest VRAM, but a prebuilt CUDA wheel must match cu121+torch+python exactly — fragile on Windows; setup risk not worth the speed. |
| sd.cpp (GGUF, C++) | most portable, but needs a subprocess bridge into the Python FastAPI server — messy to integrate/maintain. |
| diffusers fp16 / fp8 single-file | OOM (8 GB / 5 GB transformer + encoder). |

**Erase family:** classical luminance/tighten/seamless levers — rejected, *measured* to fail on
real data (table above). Flux is the only lever that reconstructs texture (B), not just (A).

## Consequences

- **Positive:** removes the band **and** the ghost — the texture reconstruction no classical lever
  could do; default-off and fully optional (LaMa untouched); steady-state VRAM unchanged via cached
  embed + load/unload; art outside the text mask stays byte-identical (patch composite); decision
  grounded in **measured** VRAM/latency/quality, not eyeballing.
- **Negative / costs:** new heavy deps (`diffusers`, `gguf`) in MIT/.venv; one-time ~10.6 GB model
  download (2.6 GB Q4 transformer + 8 GB encoder); ~3–4 s/page vs LaMa's <1 s, so it is opt-in for
  "max quality" runs, not the default; the whole-page edit can subtly redraw line art, mitigated
  (not eliminated) by keeping only masked patches.
- **Follow-up:** if the one-time encoder download/footprint is unwanted, a pre-exported embedding
  could ship so the encoder is never fetched; per-region (vs whole-page) Flux passes if whole-page
  drift is ever measured to leak through a mask edge.
