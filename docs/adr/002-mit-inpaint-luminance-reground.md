# ADR 002 — Clean text erasure via per-pixel luminance re-grounding (not a diffusion inpainter)

- **Status:** **Superseded by [ADR 003](003-mit-flux-klein-optional-inpainter.md)** (2026-06-14) — the
  reground/tighten/seamless classical levers were *measured to fail on real data* (reground moved the
  band the wrong way 146→154; tighten left a ghost; seamless no effect), and this ADR's premise that
  "Flux = OOM on a 12 GB card" was overturned: a Q4 transformer + **cached prompt embedding** (encoder
  dropped from the steady loop) fits at ~5.8 GB. The band's *texture* component needs reconstruction, not
  luminance math. The `lama_lum_reground` helper remains in-tree, default-off and unused.
- **Family context:** `lama_lum_reground` is one member of the classical CPU inpaint-refinement lever
  family now documented as a whole in [ADR 005](005-mit-classical-cpu-inpaint-refinement-levers.md) —
  see it for which levers are still active (feather / context-pad / nearest-neighbour mask / font floor)
  vs. dead-weight-for-the-band (reground).
- **Original status:** Accepted (2026-06-13)
- **Context PRD:** #268 · **Slices:** #269 (helper), #270 (wiring), #271 (tune+E2E)
- **Supersedes for the "band":** the reverted content-shaped patch alpha (#266 → reverted #267)

## Context

MangaDock's MIT pipeline erases the source Japanese text and composites a translated patch
over the **original** page. Where large source text sat over **complex/dark art** (the
character's hair on the One Punch-Man benchmark), LaMa's repaint is **~18 grey-levels off**
the surrounding original, and the shift is **bidirectional within one mask** (too *light*
over dark hair, too *dark* over the lighter cheek). Compositing that off-luminance fill over
the original shows a faint **"painted band"** — text looks *painted over*, not *erased*.

Two hard facts bound the solution:

1. **VRAM-neutral.** MIT already uses ~6 GB of a 12 GB card. A diffusion inpainter (Flux
   Kontext/Klein — what the MangaTranslator reference uses) is the obvious "best" erase, but
   even the smallest quantised variant (~5–6 GB) pushes the card to ~11–12 GB → OOM. Out.
2. **The band lives at the erase region itself.** The earlier content-shaped patch alpha
   (#266) tried to fix it by reshaping the patch's opacity; it was reverted (#267) after an
   **objective luminance measurement** showed no change (band 201.5 → 201.3) — the erase
   region must stay opaque to remove the text, so the lever is the *pixel values* there, not
   the alpha shape. The LaMa blend invariant `inpainted·mask + orig·(1−mask)` also means
   outside the mask the patch is byte-identical original; the band is strictly in-mask.

## Decision

Add a pure-CPU **per-pixel, per-RGB-channel low-frequency luminance re-grounding** of the
inpaint *inside the erase mask*, before the glyphs are drawn. For each masked pixel, pull its
value toward the local original surround:

- Propagate the surrounding original into the mask with `cv2.inpaint(original, mask, TELEA)`
  so the low-frequency target is defined even deep inside a mask wider than the box kernel
  (a plain normalized box convolution leaves a wide mask's interior with no valid neighbour).
- `lowO = boxFilter(orig_filled)` (propagated original low-freq); `lowI = mask-normalized
  boxFilter(inpaint)` (the inpaint's own fill level); `delta = clip(lowO − lowI, ±max_delta)`.
- `out = inpaint + strength · delta · soft`, where `soft` is a distance-transform inner
  feather (full inside, taper to 0 at the mask edge). LaMa's high-frequency detail (hair
  strands) survives because only the low frequency is shifted.

Because the target is computed **per pixel from the local surround**, it gives a *negative*
correction over hair and a *positive* one over cheek **in one pass** — the only family that
nulls a bidirectional band. Working per RGB channel is exact for B&W manga (R=G=B → equal
shift → no chroma tint, the #156-safe property). On a uniform background the per-pixel field
collapses to a single scalar (≡ a plain mean offset). It runs on CPU outside the GPU
semaphore → **zero extra VRAM**. Gated by `InpainterConfig.lama_lum_reground` (strength,
default `0.0` → byte-identical); glyphs are drawn *after* the correction, so text can't fade
(the precise failure mode of the reverted #266).

## Alternatives considered (13-agent research workflow scores)

| Approach | Score | Verdict |
|---|---|---|
| **Per-pixel luminance re-ground (this ADR)** | **79** | bidirectional, VRAM-neutral, subsumes histogram-match + global-affine |
| Poisson `cv2.seamlessClone` | 64 | **reserved escalation** only if a residual survives along an internal hair contour (asserts on border/zero-area masks; can smudge) |
| Histogram / single mean offset | 62 | degenerate case of this ADR (uniform background) |
| Upstream `_match_luminance` global affine | 61 | nulls only the average, not the bidirectional shift |
| Whole-page render (no patch composite) | 58 | rejected — breaks the byte-identical patch contract #156 + re-encodes the page |
| Laplacian multi-band blend | 38 | rejected — only halves the band; the σ that fixes it smears screentone |
| Flux/diffusion inpainter | — | rejected — OOM on the 12 GB card |

## Consequences

- **Positive:** removes the band over complex art with no VRAM cost; one helper covers the
  uniform and bidirectional cases; default-off → risk-free; fully revertible; verified by
  **measurement** (masked-region luminance delta vs the local original < 4) rather than by
  eyeballing screenshots (which misled #266).
- **Negative / limits:** it corrects *luminance*, not destroyed *structure* — a true hair/skin
  contour that ran under the text is interpolated, not reconstructed (LaMa's job); if a
  residual step survives along such a contour, the reserved `cv2.seamlessClone` escalation is
  the next lever. `radius_frac` is tuned on the benchmark, not adaptive per region.
- **Follow-up:** per-connected-component correction (rather than per-crop) only if a crop is
  ever measured to hold two blobs over different backgrounds.
