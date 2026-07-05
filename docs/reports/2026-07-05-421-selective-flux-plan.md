# #421 Selective Flux — design draft (pre-brainstorm)

## Problem
Text drawn directly over textured art (One-Punch p1: 「そうだよ…」 over the man's hair) leaves a gray smear
with LaMa — it cannot synthesize hair texture back. Proven: no classical lever helps (flatten = flat-paper
only; restrict/tighten = mask-size, the glyph holes are big enough that hair is gone either way; reground/
seamless = luminance not texture). Flux Klein reconstructs it correctly (user-verified vs target). All-Flux
is rejected: every page would pay load+diffusion cost. Route ONLY text-over-textured-art regions to Flux.

## Constraints (hard)
- RTX 4070 12GB. ADR 003 proves Flux Klein Q4 fits: cached prompt embedding (no 8GB encoder in steady
  loop), transformer 2.6GB + VAE, peak 5.8GB/page, load→inpaint→unload = steady-state VRAM unchanged.
- Never two GPU-heavy models resident together with LaMa active — sequence, don't co-reside.
- Gated + byte-identical off (`MIT_SELECTIVE_FLUX`), prod full-page-inpaint path first (per-crop later).
- Fallback: any Flux failure → keep the LaMa result (never worse than today).
- North star: smallest routing surface; reuse existing seams (inpainting registry, FluxKleinInpainter,
  texture-variance discriminator from adaptive_dilate_mask).

## Proposed design (v0 — to be pressure-tested)
Pipeline stays LaMa-first (full-page). Selective Flux is a REPAIR pass on top:

1. **Discriminator (pure, TDD-able):** for each erase-mask component, measure background texture in a ring
   just outside the component (same std-dev machinery as `adaptive_dilate_mask`, inverted use):
   `textured = ring_std >= flat_std(18)`. Additional gates: component ink area >= min_px (skip tiny),
   region overlaps actual art ink (original gray < 90 outside textline zone). Output: list of
   text-over-art boxes (padded, merged if overlapping).
2. **Flux repair pass (after LaMa full-page inpaint):** if any boxes found AND gate on:
   load FluxKleinInpainter (ADR 003 embed-cache path) → for each box: crop original image (context pad
   ~256), crop erase mask to box → Flux inpaint crop → paste result into `full_inpainted` (only inside the
   erase mask + small feather so LaMa background elsewhere is untouched) → unload Flux.
3. **VRAM guard:** check free VRAM before load; insufficient → log + skip (LaMa result stands).
4. **Batch amortization (later, not v0):** keep Flux loaded across pages within one batch job.

## Open questions for the brainstorm
Q1. Discriminator: is ring-std around mask components the right signal, or should the unit be the REGION
    (textblock) — e.g. fraction of region bbox covered by non-textline dark ink? False-positive cost =
    unnecessary Flux (slow); false-negative = smear stays.
Q2. Paste-back: full crop replace vs mask-only + feather? Flux output may shift global tone of the crop —
    does mask-only compositing avoid seams, or do we need the #268 reground/seamless levers on the paste?
Q3. Sequencing: LaMa full-page ALWAYS first then Flux repair (2 inpaints on those px) — vs excluding the
    routed boxes from the LaMa mask and Flux-inpainting them exclusively (1 inpaint each)? Which is
    simpler/safer given patches slice their background from full_inpainted?
Q4. Where is the cleanest seam: a new pure module `flux_routing.py` (discriminator) + ~15 lines in the
    full-page block of manga_translator.py, vs pushing routing into the inpainting registry dispatch?
Q5. Cold-start UX: single-page translate pays Flux load (~seconds). Accept, or add a "warm" knob later?
Q6. Failure modes we're missing (Flux hallucinating new art, tone mismatch on B/W manga, mask feather
    interacting with own_work_alpha/changed_alpha patch compositing)?

## Verification plan
- TDD the discriminator (pure) + paste-back compositor (pure).
- Deterministic replay: captured real mask (the p1 hair case) → assert box found; flat-bubble pages →
  assert no boxes (no unnecessary Flux).
- Live E2E: One-Punch p1 LaMa-only vs selective — hair region matches Flux/target; timing + VRAM logged.
- Benchmark MD+PNG per rules; issue #421 body updated (bilingual).
