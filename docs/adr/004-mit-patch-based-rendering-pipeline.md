# ADR 004 — Patch-based rendering pipeline: per-group GPU stages over a byte-identical composite contract

- **Status:** Accepted (2026-06-14) — implemented. The output path described here is the
  live `translate_patches` path; `full_page_inpaint` and every refinement lever (mask-tighten,
  luminance re-ground, seamless-clone, feather, inpaint-context-pad) are real but **default-OFF**
  opt-ins, safe precisely *because* of the byte-identical composite contract this ADR defines.
- **Context PRD:** #156 (patch composite + ICC) · #187 (PatchRenderer / patch_geometry seam) ·
  #137 (PatchStore) · #158/#159/#160 (text layer) · #166/#170/#179 (balloon-aware grouping)
- **Defines:** the "#156 patch contract" that ADR 002 and ADR 003 both reference but neither defines.

## Context

MIT's job is to translate a manga page and hand the Reader something it can show. The naive design
is *whole-page render*: run detect → OCR → translate → mask → inpaint → render on the page and emit
one new image. That has three problems for this product:

1. **It re-encodes the whole page.** Every untouched pixel is round-tripped through the renderer and
   PNG encoder, so the output is no longer the original page with text replaced — it is a *new*
   image. Any downstream system that wants to reason about "what changed" can't, and any artifact in
   the render (color drift, recompression) is now baked into the entire page.
2. **It makes refinement knobs dangerous.** Inpainting/rendering quality levers (luminance
   re-ground, mask-tighten, feathering, alternate inpainters — see ADR 002, ADR 003) all mutate the
   whole-page output. You cannot A/B one knob against another, or ship one default-OFF, if turning it
   on rewrites every pixel of the page.
3. **Per-crop inpaint quality vs. VRAM is a real tradeoff.** Inpainting only the small text crop
   starves LaMa's FFC global branch of page context and leaves a gray blob where large text sat over
   complex/dark art; inpainting the whole page once is cleaner but costs more VRAM.

The output path is also a **contract boundary**, not just an internal detail. The MIT worker
serializes its result and ships it to the Backend, which persists it, and the Frontend composites it.
Three independent components depend on the exact shape of what `translate_patches` returns:

- **Backend cache** — `PatchStore` (`Backend/src/books/patch-store.ts`) is "the single owner of
  Patch Set files" and writes each patch as its own PNG keyed
  `{src}__{tgt}__{model}__p{page}__r{region}.png` (lines 16-21). Per-region patches *are* the cache
  granularity.
- **Backend anti-corruption layer** — `mit-webhook.controller.ts:75-97` destructures MIT's flat wire
  payload `{ taskId, pageIndex, imgWidth, imgHeight, patches, regions, error }` and adapts it into
  the service's structured `result = { imgWidth, imgHeight, patches, regions }` (line 97). It is
  explicitly "the anti-corruption layer between MIT's wire format and the service's domain shape"
  (lines 73-74).
- **Frontend compositing** — `MangaReader.tsx:1652-1668` overlays each patch as an
  absolutely-positioned `<img>` (`left/top/width/height` as percentages) on top of the *original*
  page `<img>`. The original page shows through everywhere a patch isn't, and each patch shows
  through to the page everywhere its own alpha/mask isn't.

ADR 003 leaned on this — "every pixel outside the text mask stays **byte-identical original** … so
the #156 patch contract holds" — without an ADR defining the contract. This ADR is that definition.

## Decision

`translate_patches` (`MIT/manga_translator/manga_translator.py:1401-1509`) is MIT's output path.
It runs **detect / OCR / translate once on the full page**, then renders text region-by-region as
independent PNG patches over a composite contract:

**1. Page-level work once, then group.** `_translate_until_translation` + `_run_text_translation`
run on the whole page (lines 1413-1421). Regions are filtered by source language (line 1432), then
**grouped balloon-aware**: `_group_nearby_regions(regions, pad + render_extra=120, …)` merges any
two regions whose expanded render canvases would overlap into one group (lines 1449-1456). When
`detector.det_bubble_seg` is on, regions are first tagged with their speech balloon (#170) so a
group never spans two balloons (lines 1439-1443); grouping then routes through
`bubble_association.group_regions` (line 1387).

**2. Per-group pipeline: mask → inpaint → render → PNG encode.** Each group is independent and runs
through `PatchRenderer.process_group` (`patch_renderer.py:73-298`): crop the group rect (+`pad=40`
+`render_extra=80`) → build crop-local regions → text-only mask → mask refinement → inpaint →
text rendering → PNG encode. `PatchRenderer.__init__` holds the per-request shared state (page `ctx`,
`config`, geometry constants, ICC, semaphore, optional full-page inpaint) so `process_group` is a
clean, testable unit; the only driver-bound dependencies are the three GPU coroutines
(`_run_mask_refinement` / `_run_inpainting` / `_run_text_rendering`).

**3. GPU concurrency gated by a semaphore; PNG encode runs CPU-bound outside it.** All groups are
fired concurrently via `asyncio.gather` (manga_translator.py:1499); an
`asyncio.Semaphore(PATCH_CONCURRENCY)` — **default 3** (manga_translator.py:1464) — gates only the
GPU-heavy mask+inpaint block (`async with _sem`, patch_renderer.py:141). PNG compression is offloaded
to a thread-pool executor *outside* the semaphore with a 30 s timeout
(patch_renderer.py:276-286), so one group's CPU encode overlaps the next group's GPU work.

**4. The composite contract — the load-bearing part.** Each patch is returned as a flat dict
`{x, y, w, h, img_png}` (patch_renderer.py:289-295), and the full result is
`{img_width, img_height, patches, regions}` where `regions` is `regions_payload(regions)`
(manga_translator.py:1509). `regions_payload` (`text_layer.py:13-21`) is `[{src, dst}]` per region —
the #158 text layer that enables rolling context (#159) and translation memory (#160). The whole
dict is pickled and shipped at `mode/share.py:101` (the `/simple_execute/translate_patches` route
returns `pickle.dumps(patches)`). The contract
is: **a patch composites over the ORIGINAL page outside its erase mask.** Inside the erase mask the
patch is the translated render (inpaint + glyphs); outside it the patch is byte-identical original.
Because the Reader paints the original page underneath (`MangaReader.tsx:1645`) and the patch on top
at `(x,y,w,h)`, the page is *original everywhere a patch isn't, and original everywhere a patch's mask
isn't*. This is what "byte-identical original outside the mask" means concretely.

**5. ICC carried per patch.** Manga scans often embed non-sRGB profiles (e.g. "Dot Gain 20%"); a
browser color-manages the page through that curve but renders an *untagged* patch as plain sRGB,
leaving the patch visibly darker than the page around it. So the source page's `icc_profile`
(manga_translator.py:1412) is threaded into every `encode_patch_png` call
(patch_renderer.py:278). `utils/patch_png.py:22-62` embeds it — but only when valid: a GRAY profile
(the common manga-scan case) is silently ignored by browsers on an RGB PNG, so a GRAY-tagged patch
is converted to mode `L` (or `LA` when feathered) to keep the profile valid (patch_png.py:41-58).

**6. Pure geometry, isolated.** All coordinate/mask math
(`build_local_region`, `create_text_only_mask`, `crop_mask_for_patch`, `expand_inpaint_crop`,
`feather_alpha`, `union_refined_with_fallback`, …) lives in `patch_geometry.py` as `self`-free
numpy/cv2 functions with no model/driver dependency (patch_geometry.py:1-14), golden-numpy
unit-tested in isolation.

**7. Full-page inpaint vs. per-crop inpaint — both kept, as a tradeoff.** When
`config.inpainter.full_page_inpaint` is on (default OFF), the whole page is inpainted **once**
(manga_translator.py:1472-1489) and each group slices its clean background out of it
(patch_renderer.py:123-129), skipping per-crop mask refinement + inpaint. This is cleaner (LaMa saw
the whole page; no per-crop gray blob) but costs more VRAM. Default OFF → each group inpaints its
own crop (patch_renderer.py:130-195), which is faster/lower-VRAM but starves LaMa's FFC global branch
on large text over complex art. Both paths are retained deliberately as a quality/VRAM lever.

## Alternatives considered

| Option | Verdict |
|---|---|
| **Whole-page render, no patch composite** | **Rejected.** Re-encodes every page pixel → output is a new image, not "original with text swapped"; breaks the byte-identical #156 contract that PatchStore, the webhook anti-corruption layer, and the Reader overlay all depend on; and makes every refinement knob unsafe to A/B or ship default-OFF (turning one on rewrites the whole page). |
| **Per-crop inpaint as the only path** | **Rejected as the *only* path** (kept as the default-fast path). Inpainting just the text crop starves LaMa's FFC global branch of page context → a gray blob where large text sat over complex/dark art. Full-page inpaint reconstructs it cleanly but needs more VRAM, so both are retained behind `full_page_inpaint` rather than forcing one (patch_renderer.py:47-51, 123-129). |
| **Untagged (sRGB) patch PNGs** | **Rejected.** On a page with a non-sRGB embedded profile, an untagged patch renders darker than the color-managed page around it (#156 investigation). Patches carry the source ICC, with the GRAY→L conversion so the profile is actually honored (patch_png.py). |
| **Process all groups with no concurrency gate** | **Rejected.** GPU inpaint is the bottleneck and would OOM/thrash if every group ran its inpaint at once; gating only the GPU block with a default-3 semaphore (and running PNG encode outside it) overlaps CPU encode with the next group's GPU work. |

## Consequences

- **Positive:**
  - The byte-identity-outside-mask contract is the single thing that makes every refinement knob
    **safely opt-in and A/B-testable** — ADR 002 (luminance re-ground) and ADR 003 (Flux Klein
    inpainter) are both default-OFF levers that only mutate inside-mask pixels, so they can be
    shipped, tuned, and compared without risk to the rest of the page.
  - Per-region patches are the **cache granularity**: PatchStore persists one PNG per region, so the
    Backend caches/serves exactly the changed regions over the unchanged original page.
  - The `{src, dst}` regions payload is the #158 text layer powering rolling context (#159) and
    translation memory (#160).
  - `PatchRenderer` + pure `patch_geometry` make the orchestration unit-testable by stubbing the
    three GPU stages and golden-testing the geometry, with no ML stack.
  - Semaphore-gated GPU + out-of-band CPU PNG encode keeps GPU saturated without OOM.
- **Negative / limits:**
  - The output path is a **load-bearing cross-service contract**: the `{x,y,w,h,img_png}` /
    `{img_width,img_height,patches,regions}` shape is pickled at share.py and re-shaped by the
    webhook anti-corruption layer — any change to it ripples into Backend caching and Frontend
    compositing and must be coordinated across three components.
  - ICC handling is subtle and a known foot-gun: an untagged or wrongly-tagged patch renders darker
    than the page; the GRAY-profile-on-RGB-is-ignored rule (mode `L`/`LA` conversion) is non-obvious.
  - Full-page inpaint is cleaner but costs VRAM; per-crop is cheaper but can leave gray blobs on large
    text over complex art — the tradeoff is configuration, not a solved problem.
  - Grouping uses fixed geometry constants (`pad=40`, `render_extra=80`, threshold 120) tuned for the
    benchmark pages, not adaptive.
- **Follow-up:**
  - A per-Batch-Job translation-context seam (#140) so cross-page context (reset per request today,
    manga_translator.py:1390-1399) can be scoped to a job rather than wiped each page.
  - Adaptive grouping/crop padding instead of fixed constants.
  - The Flux-Klein whole-page-edit path (ADR 003) relies on this composite to discard whole-image
    drift; if drift is ever measured to leak across a mask edge, a per-region Flux pass is the
    fallback noted there.
