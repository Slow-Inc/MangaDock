# ADR 005 — Classical CPU inpaint-refinement levers (mask tighten, luminance reground, seamless clone, feather, context-pad, nearest-neighbour mask, union-fallback)

- **Status:** Accepted (2026-06-14) — **partially live.** The *family* is in-tree and load-bearing,
  but its members split: `crop_mask_for_patch` (INTER_NEAREST), `union_refined_with_fallback`, and
  `page_scaled_font_min` are **unconditionally active** (not gated, applied every patch run);
  `patch_feather_radius`, `inpaint_context_pad`, `mask_tighten`, `lama_lum_reground`, and
  `seamless_clone` are **opt-in, default-off knobs**. `lama_lum_reground` (and `mask_tighten` /
  `seamless_clone` *for the painted band*) is now **default-off dead-weight kept for rollback** —
  the band fix has been re-assigned to the optional Flux inpainter (ADR 003, **accepted but not yet
  wired in code** — `Inpainter` has no `flux_klein` member as of this writing), not these levers.
  Net effect today: the painted band is handled by *neither* (the classical knobs are off, Flux is
  unbuilt) until Flux lands.
- **Area:** MIT (per-region "patch" render path)
- **Context PRD:** #248 (mask halo), #249 (context pad), #250 (font floor), #173 (feather), #268
  (band-erasure levers)
- **Relates to:** [ADR 002](002-mit-inpaint-luminance-reground.md) (the `lama_lum_reground` member, now
  Superseded for the band) · [ADR 003](003-mit-flux-klein-optional-inpainter.md) (the optional Flux
  inpainter that supersedes the classical *band* fix on paper and is meant to sit above this family as
  the heavy escalation — **decision accepted, implementation pending**, no `flux_klein` enum/inpainter
  in the tree yet)

This ADR is a **consolidation record**: it documents the *whole* classical-lever family and pins down,
post-measurement, which members are live versus dead-weight. ADR 002 documents one member
(`lama_lum_reground`) in isolation; this record places it inside the family and is the place a
maintainer should look to tell which levers actually run today.

## Context

MIT's per-region "patch" path (`PatchRenderer.process_group` in
`MIT/manga_translator/patch_renderer.py`) erases source Japanese text from a crop, inpaints with
LaMa, then composites a translated PNG patch over the **original** page. Every lever in this family
exists to make that per-crop LaMa fill look less like a "painted over" rectangle and more like the
source text was never there — **without** spending extra VRAM (the hard MIT constraint: it already
uses ~6 GB of a 12 GB card) and **without** disturbing pixels outside the erase mask (the #156
byte-identical patch contract).

The forces that produced the family:

1. **No VRAM budget for a second model.** The whole family is pure `cv2`/`numpy`, runs on CPU
   outside the GPU semaphore, and adds **zero** GPU memory. That is what made each lever cheap
   enough to add as a knob rather than a redesign.
2. **The byte-identical-outside-mask guarantee is load-bearing.** Each helper that touches pixels
   re-asserts that the area outside the erase mask is returned untouched
   (`reground_inpaint_luminance` ends with `out[valid] = inp[valid]`; `feather_alpha` with
   `radius <= 0` returns a hard alpha identical to the un-feathered patch; `expand_inpaint_crop`
   slices the inpaint back to the exact render rect so the rendered patch footprint is unchanged).
   This is what lets every lever be added as opt-in without risk of whole-image drift.
3. **Several distinct failure modes, each with its own lever.** A mask scaled with INTER_LINEAR
   grows a halo (#248); a wholesale `cv2.max` union forces LaMa to erase clean background around
   every glyph (#248); a tight crop starves LaMa's FFC global branch (#249); the auto font floor
   computed on a small crop renders fallback-path text unreadably small (#250); a rectangular patch
   edge shows a seam over screentone (#173); and large source text over dark art leaves a "painted
   band" (#268).

The result was an **escalation ladder of small, independent, CPU-only refinements** — each one
defaulting to the byte-identical no-op so it can be turned on per-run and measured in isolation.

## Decision

Keep a family of classical, CPU-only post-processing levers as the inpaint-refinement layer of the
patch path, each preserving outside-mask pixels byte-identical. All helpers live as `self`-free
functions in `MIT/manga_translator/patch_geometry.py` (golden-numpy unit-tested) and are applied in a
fixed order in `MIT/manga_translator/patch_renderer.py`.

**Always-on members (not gated; run every patch render):**

- **(f) `crop_mask_for_patch` — nearest-neighbour mask resize.** When the raw detection mask must be
  resized to the patch crop, it uses `cv2.INTER_NEAREST`, not INTER_LINEAR
  (`patch_geometry.py:122-126`). INTER_LINEAR bleeds the binary 255s into a gradient that the
  `> 0` re-binarise turns into fattened edges, which makes LaMa over-erase; nearest keeps the edge
  tight. Wired unconditionally at `patch_renderer.py:134`.
- **(g) `union_refined_with_fallback` — tight CRF mask + per-component fallback.** Keeps the tight
  CRF-refined mask everywhere it has coverage and falls back to the dilated `text_only_mask` **only
  inside the connected components the refinement missed entirely**
  (`patch_geometry.py:132-157`), instead of the old wholesale `cv2.max(refined, text_only)` that
  erased a fat halo around every glyph. Applied unconditionally at `patch_renderer.py:150` after
  mask refinement.
- **(h) `page_scaled_font_min` — page-scaled fallback font floor.** Floors the render font to
  `round((h+w)/200)` computed on the **full page**, not the small crop (whose floor lands at
  ~3-4px, unreadable on the vertical / occupancy>1 / no-balloon / SFX fallback paths), keeping any
  larger explicit override (`patch_geometry.py:160-169`). Applied once per request on a deep-copied
  config so the shared `_translate` config is never mutated (`patch_renderer.py:62-67`).

**Opt-in members (default-off knobs, byte-identical no-op when off):**

- **(a) `mask_tighten` (`InpainterConfig.mask_tighten`, default `False`).** Shrinks the box mask to
  the actual ink strokes — pixels whose local-contrast luminance differs from a TELEA-propagated
  background by more than a threshold — so LaMa repaints thin strokes, not the whole rectangle;
  returns the coarse mask unchanged if too few strokes are found so source text is never left
  un-erased (`patch_geometry.py:240-268`, applied at `patch_renderer.py:160-161`).
- **(b) `lama_lum_reground` (`InpainterConfig.lama_lum_reground`, default `0.0`).** Per-pixel,
  per-RGB-channel low-frequency luminance correction **inside the mask**, pulling each masked
  pixel's low frequency toward its local original surround (the only family member that nulls a
  *bidirectional* band in one pass) while preserving LaMa's high-frequency detail; `strength <= 0`
  returns the input unchanged and the function enforces `out[valid] = inp[valid]`
  (`patch_geometry.py:271-343`, applied at `patch_renderer.py:217-224`). This is the ADR 002 member.
- **(c) `seamless_clone` (`InpainterConfig.seamless_clone`, default `False`).** Poisson
  re-integration via `cv2.seamlessClone` so the DC band vanishes by gradient integration; the mask
  is eroded and cleared off the 1-px border (the call asserts on border-touching/empty masks) and
  the input is returned when nothing usable remains. Reserved escalation — it re-integrates already
  smooth gradients, so it cannot synthesise texture (`patch_geometry.py:212-237`, applied at
  `patch_renderer.py:232-240`).
- **(d) `patch_feather_radius` (`RenderConfig.patch_feather_radius`, default `0`).** Distance-
  transform alpha fade over a `radius`-px band *outside* the patch content so the rectangular patch
  edge blends into the page instead of showing a seam; `radius <= 0` returns a hard alpha
  byte-identical to the un-feathered patch (`feather_alpha`, `patch_geometry.py:190-209`, applied at
  `patch_renderer.py:264-271`).
- **(e) `inpaint_context_pad` (`InpainterConfig.inpaint_context_pad`, default `0`).** Widens the
  inpaint crop by `pad` px on each side to feed LaMa's FFC global branch real background, then
  slices the result back to the **exact render rect** so the rendered patch footprint (#156) is
  unchanged; `0` → tight crop, byte-identical (`expand_inpaint_crop`, `patch_geometry.py:172-187`,
  applied at `patch_renderer.py:170-187`).

**Application order in `process_group`** (page font floor at construction →) refine mask →
`union_refined_with_fallback` → `mask_tighten` → `expand_inpaint_crop` + LaMa →
`reground_inpaint_luminance` → `seamless_clone` → render → `feather_alpha` → PNG encode. Each step is
guarded by its knob and wrapped so a failure logs a warning and falls back to the prior buffer.

**Post-measurement status (the reason this ADR exists now).** PRD #268 measured the band-targeting
members on the live One Punch-Man page (recorded in ADR 002/003): `lama_lum_reground` moved the band
the wrong way (146→154), `mask_tighten` left a ghost of the original text, `seamless_clone` had no
measurable effect. ADR 003 concluded no VRAM-neutral *classical* method fixes the band cleanly — the
band's **texture** component needs reconstruction (a diffusion model's job) — and re-adopted Flux.2
Klein-4B as the optional band fix *as a decision* (ADR 003 is Accepted; the `flux_klein` inpainter is
not yet implemented in the tree). Consequently **`lama_lum_reground` is dead-weight FOR THE BAND**
(kept in-tree, default-off, for rollback / the uniform-background case), and `mask_tighten` /
`seamless_clone` are likewise not the band fix. The **halo/edge levers** (INTER_NEAREST mask,
`union_refined_with_fallback`), the **context/blend levers** (`inpaint_context_pad`,
`patch_feather_radius`), and the **font floor** (`page_scaled_font_min`) remain **genuinely active
and useful** — they solve different problems than the band and were never disproven.

## Alternatives considered

- **Diffusion inpainter for the band instead of classical luminance/blend math.** ADR 002 rejected
  Flux on the premise "even the smallest quantised variant pushes a 12 GB card to OOM" — a premise
  ADR 003 showed was wrong for the fixed-removal-prompt use case (encoder embedding cached/dropped →
  ~5.8 GB peak). ADR 003 re-adopts Flux.2 Klein-4B (GGUF Q4) as the optional band fix above this
  family *as an accepted-but-unbuilt decision* (no `flux_klein` enum member yet). So the family is the
  *light* rung of the ladder; Flux is the intended heavy rung once wired.
- **Wholesale `cv2.max(refined, text_only)` union.** Rejected (#248): OR-ing the dilated rectangle
  mask wholesale forces LaMa to erase a fat halo of clean background around every glyph, destroying
  screentone/line-art next to bubbles. Replaced by per-component fallback (`union_refined_with_fallback`).
- **INTER_LINEAR mask resize.** Rejected (#248): the gradient it produces, re-binarised by `> 0`,
  fattens mask edges and makes LaMa over-erase. INTER_NEAREST keeps the binary edge tight.
- **Enlarging the rendered patch to give LaMa more context.** Rejected: it would break the #156
  patch-footprint contract. `inpaint_context_pad` instead inpaints a wider crop and slices the
  result back to the unchanged render rect, so the patch footprint is identical.
- **(within the band sub-problem)** histogram/single-mean offset, global-affine `_match_luminance`,
  whole-page render, Laplacian multi-band blend — all scored and rejected in ADR 002; not repeated
  here.

## Consequences

- **Positive:** a quality fine-tuning ladder of cheap, independent, CPU-only (zero extra VRAM)
  refinements sitting *below* the heavy optional Flux path; every lever defaults to a byte-identical
  no-op and is measured in isolation; the always-on members (tight nearest-neighbour mask,
  per-component union fallback, page-scaled font floor) fix real halo/readability defects that have
  nothing to do with the band and need no knob; the byte-identical-outside-mask guarantee makes
  every lever composable and risk-free to enable per run.
- **Negative / limits:** the luminance/blend band levers (`lama_lum_reground`, `seamless_clone`, and
  `mask_tighten` for the band) are **dead-weight** post-measurement — kept for rollback and the
  uniform-background case but not the band fix; they correct *luminance*, not destroyed *structure*.
  It is **easy to misread which levers are live after ADR 003**: the band ones look active (they are
  fully wired and gated) but are intentionally left off, while three unrelated members run on every
  patch render. This consolidation record exists precisely to disambiguate that.
- **Follow-up:** if the band knobs are confirmed permanently superseded by Flux for all cases, retire
  `lama_lum_reground` / `seamless_clone` / `mask_tighten` (and their config fields) rather than carry
  them indefinitely; per-connected-component luminance correction only if a crop is ever measured to
  hold two blobs over different backgrounds (ADR 002 follow-up).
