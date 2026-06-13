"""Stage adapters over the leaf `dispatch_*` calls (#187 seam S15).

Each `run_<stage>` is the `read ctx-subset → dispatch_* → return value` core of a
`MangaTranslator._run_*` adapter, lifted byte-for-byte. The driver method keeps
its `time.time()` + `_model_usage_tracker.touch(...)` instrumentation (the S3
concern) and delegates the dispatch here, so the many-argument dispatch calls
(detection has 11) become independently unit-testable by stubbing `dispatch_*`.
This is the groundwork the future StageRunner (S23) drives as a uniform list.

The `**ctx` splat into `dispatch_colorization` (landmine L15) is preserved
verbatim. No model/usage state lives here — these are thin, pure adapters.
"""
from .colorization import dispatch as dispatch_colorization
from .upscaling import dispatch as dispatch_upscaling
from .detection import dispatch as dispatch_detection
from .detection_postproc import merge_sfx_detections
from .mask_refinement import dispatch as dispatch_mask_refinement
from .inpainting import dispatch as dispatch_inpainting
from .rendering import dispatch as dispatch_rendering, dispatch_eng_render, dispatch_eng_render_pillow
from .config import Renderer
from .utils import LANGUAGE_ORIENTATION_PRESETS


async def run_colorizer(config, ctx, device):
    #todo: im pretty sure the ctx is never used. does it need to be passed in?
    return await dispatch_colorization(
        config.colorizer.colorizer,
        colorization_size=config.colorizer.colorization_size,
        denoise_sigma=config.colorizer.denoise_sigma,
        device=device,
        image=ctx.input,
        **ctx
    )


async def run_upscaling(config, ctx, device):
    return (await dispatch_upscaling(config.upscale.upscaler, [ctx.img_colorized], config.upscale.upscale_ratio, device))[0]


async def run_detection(config, ctx, device, verbose):
    result = await dispatch_detection(config.detector.detector, ctx.img_rgb, config.detector.detection_size, config.detector.text_threshold,
                                    config.detector.box_threshold,
                                    config.detector.unclip_ratio, config.detector.det_invert, config.detector.det_gamma_correct, config.detector.det_rotate,
                                    config.detector.det_auto_rotate,
                                    device, verbose)
    # #168: optional SFX/outside-bubble second pass (AnimeText YOLO). Boxes the
    # primary detector missed are appended as empty textlines for OCR to read.
    if config.detector.det_sfx:
        result = merge_sfx_detections(ctx, result, device)
    return result


async def run_mask_refinement(config, ctx, verbose, kernel_size):
    return await dispatch_mask_refinement(ctx.text_regions, ctx.img_rgb, ctx.mask_raw, 'fit_text',
                                          config.mask_dilation_offset, config.ocr.ignore_bubble, verbose, kernel_size)


async def run_inpainting(config, ctx, device, verbose):
    return await dispatch_inpainting(config.inpainter.inpainter, ctx.img_rgb, ctx.mask, config.inpainter, config.inpainter.inpainting_size, device,
                                     verbose)


async def run_text_rendering(config, ctx, font_path):
    """`font_path` is resolved by the driver's `_render_font_path` (#176, uses
    `self.font_path`); the renderer branch + the three dispatch variants live
    here. `ctx.render_mask` is the always-None invariant (L5), preserved."""
    if config.render.renderer == Renderer.none:
        output = ctx.img_inpainted
    # manga2eng currently only supports horizontal left to right rendering
    elif (config.render.renderer == Renderer.manga2Eng or config.render.renderer == Renderer.manga2EngPillow) and ctx.text_regions and LANGUAGE_ORIENTATION_PRESETS.get(ctx.text_regions[0].target_lang) == 'h':
        if config.render.renderer == Renderer.manga2EngPillow:
            output = await dispatch_eng_render_pillow(ctx.img_inpainted, ctx.img_rgb, ctx.text_regions, font_path, config.render.line_spacing)
        else:
            output = await dispatch_eng_render(ctx.img_inpainted, ctx.img_rgb, ctx.text_regions, font_path, config.render.line_spacing)
    else:
        output = await dispatch_rendering(ctx.img_inpainted, ctx.text_regions, font_path, config.render.font_size,
                                          config.render.font_size_offset,
                                          config.render.font_size_minimum, not config.render.no_hyphenation, ctx.render_mask, config.render.line_spacing,
                                          bubble_fit=config.render.bubble_area_fit,
                                          supersampling=config.render.supersampling,
                                          font_max_box_ratio=config.render.font_max_box_ratio,
                                          anti_overlap=config.render.anti_overlap,
                                          font_size_max=config.render.font_size_max)
    return output
