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
import traceback

import numpy as np
from PIL import Image

from .patch_geometry import (
    build_local_region,
    create_text_only_mask,
    crop_mask_for_patch,
    feather_alpha,
    union_refined_with_fallback,
)
from .utils import Context
from .utils.patch_png import encode_patch_png


class PatchRenderer:
    def __init__(self, driver, ctx, config, *, pad, render_extra,
                 img_w, img_h, source_icc, sem, logger):
        self.driver = driver
        self.ctx = ctx
        self.config = config
        self.pad = pad
        self.render_extra = render_extra
        self.img_w = img_w
        self.img_h = img_h
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
            text_only_mask = create_text_only_mask(crop_rgb.shape[0], crop_rgb.shape[1], local_regions)
            raw_mask_source = ctx.mask_raw if ctx.mask_raw is not None else ctx.mask
            if raw_mask_source is not None:
                patch_ctx.mask_raw = crop_mask_for_patch(
                    raw_mask_source, x1, y1, x2, y2, img_h, img_w,
                )
            else:
                patch_ctx.mask_raw = text_only_mask
            patch_ctx.mask = None

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

                try:
                    patch_ctx.img_inpainted = await driver._run_inpainting(config, patch_ctx)
                except Exception as e:
                    logger.warning(
                        f"[PatchTranslate] inpainting failed for group ({x1},{y1},{x2},{y2}) "
                        f"[{type(e).__name__}]: using original crop"
                    )
                    patch_ctx.img_inpainted = crop_rgb

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
