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

---
# v1 — brainstorm synthesis (antigravity=system / codex=impl / qwen-9arm=logic, 2026-07-05)

## Convergence (all 3 independent reviewers)
- **Q1:** component-level ring-std as PRIMARY + a SECONDARY art-evidence gate (dark-ink/edge density in the
  padded annulus outside the textline zone). Raw std alone over-routes (screentone, JPEG noise, panel
  borders → est. 30-50% of regions). Blur before measuring std (kills JPEG noise). Watch the
  **black-hair false-negative**: flat dark fill has LOW variance → add an edge-density check (codex's
  biggest risk).
- **Q2:** mask-only paste + small feather; composite in float32; reuse `reground_inpaint_luminance`
  (tone drift) with grayscale-lock (chroma bleed). **Feather ≤ 8px** — wider spills past `own_work_alpha`'s
  mask_margin and gets cropped into a hard seam (antigravity, concrete: patch_geometry.py:501-522).
- **Q4:** pure module (`selective_flux.py` / `flux_routing.py`) + explicit ~15-line call in
  manga_translator.py; do NOT push routing into the inpainter registry (it stays "image+mask→inpaint").
  Wire BOTH full-page-patch and single-page `_translate` paths.
- **Q5:** accept single-page cold start (load ≈ 2.6GB transformer only, embed cached); batch amortization
  later via refcount/keep-loaded-within-job.
- **Q6:** hallucination bounded by: small crops (min context pad, cap crop area), steps=4, fixed seed 0,
  grayscale paste-back; skip huge components.

## Divergence resolved: Q3 (LaMa-first vs skip-LaMa)
qwen argued LaMa-first is "wasteful and harmful — Flux must see the clean original, not LaMa's smear."
**Resolution: both sides are right and compatible — the v0 plan already feeds Flux the ORIGINAL crop**
(step 2: "crop original image"), never the LaMa output, so the "harmful" half doesn't apply. The "wasteful"
half is marginal: LaMa runs ONE full-page pass regardless (its cost doesn't scale with the routed boxes).
Keep **LaMa-first repair-pass** for its two hard benefits (fail-open fallback = never worse than today;
`full_inpainted` provenance stays single-source for patch slicing/own_work_alpha) with **Flux input =
original crop + erase-mask crop**. qwen's cross-region consistency concern is also covered: repair happens
on `full_inpainted` BEFORE PatchRenderer is constructed, so every patch slices the repaired background.

## NEW hard requirements from the brainstorm (were missing in v0)
1. **Explicit blocking LaMa unload before Flux load** — the async ModelReaper sweeps ~1s; racing it
   co-resides both models → OOM (antigravity's biggest risk #1).
2. **Cross-page Flux lock** — `batch_concurrent=True` gathers pages with NO cross-page model semaphore;
   two pages loading Flux simultaneously = OOM crash (antigravity's biggest risk #2). Add an
   instance-level `asyncio.Lock` around the Flux load+infer+unload span.
3. **try/finally VRAM cleanup** — Flux failure must unload + `torch.cuda.empty_cache()` before fallback.
4. **Ordering vs flatten_white_captions:** run the Flux repair AFTER flatten (disjoint targets: flatten =
   white caption boxes, Flux = textured art; after-flatten avoids flatten overwriting a repair).
5. **Crop-size guard for Flux's internal 1024 downscale** (inpainting_flux_klein.py:32) — small crops must
   not be up/downscaled into mush; clamp crop long side ≤ 1024 natively.
6. **Pre-build quality gate (qwen):** ADR 003 proved FIT, not manga-hair QUALITY at 4 steps. The user has
   empirically seen full-page Flux match the target on this very page — treat that as the gate passing for
   v0, but the first live benchmark doubles as the formal quality check (plastic-hair / detail-loss watch).
7. **mask_tighten as the cheap fix is FALSIFIED** — qwen suggested it; we already tested tighten+restrict
   live on the hair case this session and the smear persists (glyph holes too big). Evidence beats guess.

## v1 build order (TDD)
1. `selective_flux.py`: `find_text_over_art_boxes(mask, img_rgb, text_only)` — pure, the 2-gate
   discriminator + box merge (TDD: hair case → 1 box; flat bubble page → 0 boxes; black-hair edge case).
2. `paste_flux_repair(full_inpainted, flux_crop, mask_crop, box)` — pure float32 mask-only feathered paste
   + reground + grayscale-lock (TDD).
3. Wire: full-page block after flatten, behind `MIT_SELECTIVE_FLUX`, with blocking-unload + Lock +
   try/finally; VRAM guard.
4. Live benchmark on One-Punch p1 (the hair case) vs target + a flat-bubble page (assert 0 routed = no
   cost regression) + timing/VRAM log. MD+PNG per rules.
