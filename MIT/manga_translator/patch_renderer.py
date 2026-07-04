"""Per-region patch renderer (#187 seam S24b).

`translate_patches` runs detect/ocr/translate once on the full page, then renders
each (proximity-grouped) region as its own PNG patch to avoid full-page
inpainting. The per-group pipeline — crop → text-only mask → mask refinement →
inpaint → render → PNG encode, gated by a GPU semaphore — was a nested closure
inside `translate_patches`. PatchRenderer holds the per-request shared state
(page `ctx`, `config`, geometry constants, the concurrency semaphore) so
`process_group(group)` is a clean, testable unit: the orchestration can be
exercised by stubbing the driver's three GPU stages.

The returned `{x, y, w, h, img_png}` dict is the byte-stable HTTP contract
(`regions_payload` + patches are pickled at share.py:99) and is preserved
verbatim. The three GPU stage coroutines (`_run_mask_refinement` /
`_run_inpainting` / `_run_text_rendering`) are the only driver-bound dependency;
geometry is the pure `patch_geometry` helpers. `logger` is injected so
`set_main_logger` swaps in the driver are honoured.
"""
import asyncio
import copy
import traceback

import numpy as np
from PIL import Image

from .patch_geometry import (
    build_local_region,
    create_text_only_mask,
    crop_mask_for_patch,
    expand_inpaint_crop,
    feather_alpha,
    page_scaled_font_min,
    reground_inpaint_luminance,
    restrict_mask_to_render_regions,
    seamless_blend_inpaint,
    tighten_text_mask,
    union_refined_with_fallback,
)
from .utils import Context
from .utils.patch_png import encode_patch_png


class PatchRenderer:
    def __init__(self, driver, ctx, config, *, pad, render_extra,
                 img_w, img_h, source_icc, sem, logger, full_inpainted=None):
        self.driver = driver
        self.ctx = ctx
        # When set (HxWx3 RGB), the whole page was inpainted ONCE upstream; each group
        # slices its clean background from it and skips per-crop mask refinement +
        # inpaint. Per-crop inpainting starves LaMa's global (FFC) branch of page
        # context and leaves a gray blob where large text sat over complex/dark art.
        self.full_inpainted = full_inpainted
        self.pad = pad
        self.render_extra = render_extra
        self.img_w = img_w
        self.img_h = img_h
        # #250: floor the render font size to a PAGE-scaled value. The renderer's
        # auto floor is (h+w)/200 computed on the small patch crop → ~3-4px, which
        # renders fallback-path text (vertical / occupancy>1 / no-balloon / SFX)
        # unreadably small. Apply on a per-request COPY so the shared / full-page
        # _translate config is never mutated. Patch-mode only (this driver).
        render_cfg = getattr(config, 'render', None)
        existing = getattr(render_cfg, 'font_size_minimum', -1)
        existing = int(existing) if existing is not None else -1
        page_min = page_scaled_font_min(img_h, img_w, existing)
        if page_min > existing:
            config = copy.deepcopy(config)
            config.render.font_size_minimum = page_min
        self.config = config
        self.source_icc = source_icc
        self.sem = sem
        self.logger = logger

    async def process_group(self, group):
        """Process a single region group: mask → inpaint → render → PNG."""
        # Alias the per-request shared state so the body below stays byte-identical
        # with the former translate_patches closure (only the 6 helper calls differ).
        pad = self.pad
        render_extra = self.render_extra
        img_w = self.img_w
        img_h = self.img_h
        ctx = self.ctx
        config = self.config
        source_icc = self.source_icc
        _sem = self.sem
        logger = self.logger
        driver = self.driver
        try:
            gx1 = min(max(0, int(r.xyxy[0]) - pad) for r in group)
            gy1 = min(max(0, int(r.xyxy[1]) - pad) for r in group)
            gx2 = max(min(img_w, int(r.xyxy[2]) + pad) for r in group)
            gy2 = max(min(img_h, int(r.xyxy[3]) + pad) for r in group)

            x1 = max(0, gx1 - render_extra)
            y1 = max(0, gy1 - render_extra)
            x2 = min(img_w, gx2 + render_extra)
            y2 = min(img_h, gy2 + render_extra)

            # #166: grow the crop to cover any balloon in this group. The crop
            # is sized to text-lines (+pad+render_extra); a balloon larger than
            # its text-lines would overflow it, and the balloon-sized fitted
            # text (set in the renderer) would render clipped at the patch edge.
            if config.render.bubble_area_fit:
                from .bubble_association import union_box
                expanded = union_box(
                    [(x1, y1, x2, y2)] + [getattr(r, 'bubble_box', None) for r in group],
                    img_w, img_h)
                if expanded is not None:
                    x1, y1, x2, y2 = expanded

            if x2 <= x1 or y2 <= y1:
                return None

            crop_rgb = np.ascontiguousarray(ctx.img_rgb[y1:y2, x1:x2].copy())
            local_regions = [build_local_region(r, x1, y1) for r in group]

            patch_ctx = Context()
            patch_ctx.input = Image.fromarray(crop_rgb)
            patch_ctx.img_rgb = crop_rgb
            patch_ctx.img_alpha = None
            patch_ctx.text_regions = local_regions
            # D (#535): the render sees only the CROP — thread the true page dims so
            # clean_layout's wrap clamp is page-relative, not crop-relative.
            patch_ctx.page_shape = (img_h, img_w)
            patch_ctx.mask = None

            if self.full_inpainted is not None:
                # Reuse the one-time full-page inpaint: LaMa saw the whole page, so the
                # background reconstructs cleanly even where large text sat over complex/
                # dark art (no per-crop gray blob). Slice this crop's clean background and
                # skip the per-crop mask refinement + inpaint entirely.
                patch_ctx.img_inpainted = np.ascontiguousarray(
                    self.full_inpainted[y1:y2, x1:x2].copy())
            else:
                text_only_mask = create_text_only_mask(crop_rgb.shape[0], crop_rgb.shape[1], local_regions)
                raw_mask_source = ctx.mask_raw if ctx.mask_raw is not None else ctx.mask
                if raw_mask_source is not None:
                    patch_ctx.mask_raw = crop_mask_for_patch(
                        raw_mask_source, x1, y1, x2, y2, img_h, img_w,
                    )
                else:
                    patch_ctx.mask_raw = text_only_mask

                # --- GPU-bound: use semaphore to limit concurrency ---
                async with _sem:
                    try:
                        patch_ctx.mask = await driver._run_mask_refinement(config, patch_ctx)
                        if patch_ctx.mask is None:
                            patch_ctx.mask = text_only_mask
                        else:
                            # #248: keep the tight CRF mask; only fall back to the
                            # dilated text_only_mask where refinement missed a region
                            # entirely — no fat halo for LaMa to over-erase.
                            patch_ctx.mask = union_refined_with_fallback(patch_ctx.mask, text_only_mask)
                    except Exception as e:
                        logger.warning(
                            f"[PatchTranslate] mask refinement failed for group ({x1},{y1},{x2},{y2}) "
                            f"[{type(e).__name__}]: using text-only fallback mask"
                        )
                        patch_ctx.mask = text_only_mask

                    # #535 empty-bubble guard: refinement hunts ALL text-like strokes in
                    # the crop — including a dropped region's text or a neighbouring
                    # group's bubble. Erasing those without re-rendering = the white
                    # empty bubble. Restrict the erase mask to this group's own regions
                    # (small margin keeps legit spill hugging a rendered glyph). The
                    # inpaint crop/context is untouched — only what gets erased narrows.
                    patch_ctx.mask = restrict_mask_to_render_regions(
                        patch_ctx.mask, text_only_mask, margin=8)

                    # #268: shrink the inpaint mask to the actual ink strokes so LaMa repaints
                    # less of the textured art (smaller band). crop_rgb is the pristine original.
                    if getattr(config.inpainter, 'mask_tighten', False) and patch_ctx.mask is not None:
                        patch_ctx.mask = tighten_text_mask(crop_rgb, patch_ctx.mask)

                    try:
                        # #249: give LaMa a wider receptive field WITHOUT enlarging the
                        # rendered patch. Inpaint a larger context crop (render rect +
                        # inpaint_context_pad px), then slice the result back to the
                        # render rect. The FFC global branch then has real background to
                        # copy instead of a starved tight crop. 0 → tight crop,
                        # byte-identical.
                        ctx_pad = int(getattr(config.inpainter, 'inpaint_context_pad', 0) or 0)
                        if ctx_pad > 0:
                            ix1, iy1, ix2, iy2, ox, oy = expand_inpaint_crop(
                                x1, y1, x2, y2, img_h, img_w, ctx_pad)
                            rh, rw = y2 - y1, x2 - x1
                            large_rgb = np.ascontiguousarray(ctx.img_rgb[iy1:iy2, ix1:ix2].copy())
                            large_mask = np.zeros((iy2 - iy1, ix2 - ix1), dtype=np.uint8)
                            large_mask[oy:oy + rh, ox:ox + rw] = patch_ctx.mask
                            render_rgb, render_mask = patch_ctx.img_rgb, patch_ctx.mask
                            # finally-restore so a failed inpaint can't leak the larger
                            # crop/mask into the render step (which expects render-rect size).
                            try:
                                patch_ctx.img_rgb, patch_ctx.mask = large_rgb, large_mask
                                large_inpainted = await driver._run_inpainting(config, patch_ctx)
                            finally:
                                patch_ctx.img_rgb, patch_ctx.mask = render_rgb, render_mask
                            patch_ctx.img_inpainted = np.ascontiguousarray(
                                large_inpainted[oy:oy + rh, ox:ox + rw])
                        else:
                            patch_ctx.img_inpainted = await driver._run_inpainting(config, patch_ctx)
                    except Exception as e:
                        logger.warning(
                            f"[PatchTranslate] inpainting failed for group ({x1},{y1},{x2},{y2}) "
                            f"[{type(e).__name__}]: using original crop"
                        )
                        patch_ctx.img_inpainted = crop_rgb

            # #268: re-ground the inpaint's low-freq luminance INSIDE the erase mask to the
            # local original surroundings, killing the "painted band" where LaMa's fill is a
            # few levels off the real art (over dark hair). Before the glyphs are drawn, so
            # text can't fade. crop_rgb is the pristine original; the mask is the per-crop
            # refined mask (or the text-only mask in the full-page-inpaint branch). Pure CPU,
            # no extra VRAM. 0 → skipped, byte-identical.
            # #268 tuning aid (env-gated, off in prod): dump the pristine crop + the raw inpaint
            # + mask so any lever's band can be measured offline (no glyph / no LLM jitter).
            import os as _os
            _dd = _os.environ.get('MIT_DEBUG_REGROUND_DUMP')
            if _dd:
                _dmask = patch_ctx.mask
                if _dmask is None and getattr(ctx, 'mask', None) is not None:
                    _dmask = ctx.mask[y1:y2, x1:x2]
                if _dmask is None:
                    _dmask = create_text_only_mask(crop_rgb.shape[0], crop_rgb.shape[1], local_regions)
                _os.makedirs(_dd, exist_ok=True)
                np.savez(_os.path.join(_dd, f'g_{x1}_{y1}.npz'),
                         crop=crop_rgb, inpaint=patch_ctx.img_inpainted, mask=_dmask)

            reground = float(getattr(config.inpainter, 'lama_lum_reground', 0.0) or 0.0)
            if reground > 0:
                reg_mask = patch_ctx.mask
                if reg_mask is None:
                    reg_mask = create_text_only_mask(crop_rgb.shape[0], crop_rgb.shape[1], local_regions)
                try:
                    patch_ctx.img_inpainted = reground_inpaint_luminance(
                        patch_ctx.img_inpainted, crop_rgb, reg_mask, strength=reground)
                except Exception as e:
                    logger.warning(
                        f"[PatchTranslate] luminance re-ground failed for group ({x1},{y1},{x2},{y2}) "
                        f"[{type(e).__name__}]: using un-grounded inpaint")

            # #268 escalation: Poisson seamless-clone the inpaint into the original (kills the
            # DC band by gradient integration). After re-ground; alternative lever for A/B.
            if getattr(config.inpainter, 'seamless_clone', False):
                seam_mask = patch_ctx.mask
                if seam_mask is None and getattr(ctx, 'mask', None) is not None:
                    seam_mask = ctx.mask[y1:y2, x1:x2]
                if seam_mask is None:
                    seam_mask = create_text_only_mask(crop_rgb.shape[0], crop_rgb.shape[1], local_regions)
                try:
                    patch_ctx.img_inpainted = seamless_blend_inpaint(
                        patch_ctx.img_inpainted, crop_rgb, seam_mask)
                except Exception as e:
                    logger.warning(
                        f"[PatchTranslate] seamless-clone failed for group ({x1},{y1},{x2},{y2}) "
                        f"[{type(e).__name__}]: using un-blended inpaint")

            # --- CPU-bound: rendering + PNG encode (outside semaphore) ---
            patch_ctx.img_rgb = patch_ctx.img_inpainted

            try:
                patch_ctx.img_rendered = await driver._run_text_rendering(config, patch_ctx)
            except Exception as e:
                logger.warning(
                    f"[PatchTranslate] rendering failed for group ({x1},{y1},{x2},{y2}) "
                    f"[{type(e).__name__}]: using inpaint-only patch"
                )
                patch_ctx.img_rendered = patch_ctx.img_inpainted

            # #535 Phase-0c: the render stamped telemetry on the LOCAL deepcopies —
            # copy it back to the original regions so the /patches payload
            # (built from the originals) can report branch/font per region.
            for orig, local in zip(group, local_regions):
                for attr in ('render_branch', 'render_font_px', 'render_dst_box'):
                    v = getattr(local, attr, None)
                    if v is not None:
                        setattr(orig, attr, v)

            # #173: optionally feather the outer band of the patch so its edge
            # blends into the page instead of showing a rectangle at the seam. The
            # crop carries a ≥120px content margin (pad+render_extra), so fading the
            # outer `patch_feather_radius` px never touches rendered text. 0 → None
            # → hard-alpha patch, byte-identical to before.
            feather = None
            feather_radius = int(getattr(config.render, 'patch_feather_radius', 0) or 0)
            if feather_radius > 0:
                ph, pw = patch_ctx.img_rendered.shape[:2]
                r = min(feather_radius, (ph - 1) // 2, (pw - 1) // 2)
                if r > 0:
                    inner = np.zeros((ph, pw), dtype=np.uint8)
                    inner[r:ph - r, r:pw - r] = 255
                    feather = feather_alpha(inner, r)

            # Offload PNG compression to thread pool to avoid blocking the event loop.
            # compress_level=1 is ~10x faster than optimize=True with ~15% larger file —
            # acceptable trade-off for interactive translation.
            loop = asyncio.get_running_loop()
            def _encode_png():
                return encode_patch_png(patch_ctx.img_rendered, icc_profile=source_icc, alpha=feather)
            logger.debug(f'[PatchTranslate] encoding PNG patch ({x2-x1}×{y2-y1} px)...')
            try:
                png_bytes = await asyncio.wait_for(
                    loop.run_in_executor(None, _encode_png), timeout=30.0
                )
            except asyncio.TimeoutError:
                logger.error(f'[PatchTranslate] PNG encode timed out for group ({x1},{y1},{x2},{y2}) — skipping patch')
                return None
            logger.debug(f'[PatchTranslate] PNG encode done ({len(png_bytes)//1024} KB)')

            return {
                'x': x1,
                'y': y1,
                'w': x2 - x1,
                'h': y2 - y1,
                'img_png': png_bytes,
            }
        except Exception:
            logger.warning(f"[PatchTranslate] region failed: {traceback.format_exc()}")
            return None
