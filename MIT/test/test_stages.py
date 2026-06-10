"""Stage adapters over the leaf `dispatch_*` calls (#187 seam S15).

Each `run_<stage>` is the body of a `MangaTranslator._run_*` adapter (the
`time.time()` + `_model_usage_tracker.touch(...)` instrumentation — the S3
concern — stays in the driver method; only the `read ctx-subset → dispatch_* →
return value` core moves here). These golden cases stub `dispatch_*` and pin the
exact positional args + post-processing, so the extraction is byte-identical.
The `**ctx` splat into `dispatch_colorization` (landmine L15) is preserved. The
async path is driven via `asyncio.run`.
"""
import asyncio
from types import SimpleNamespace

import manga_translator.stages as st
from manga_translator.config import Renderer


class FakeCtx(dict):
    """Supports both attribute access (`ctx.img_rgb`) and the `**ctx` splat."""
    __getattr__ = dict.get


def _run(coro):
    return asyncio.run(coro)


# ---- run_upscaling (tracer): single dispatch, unwraps [0], device threaded ----

def test_run_upscaling_forwards_args_and_unwraps_first(monkeypatch):
    seen = {}
    async def fake(upscaler, images, ratio, device):
        seen.update(upscaler=upscaler, images=images, ratio=ratio, device=device)
        return ['UP0', 'UP1']
    monkeypatch.setattr(st, 'dispatch_upscaling', fake)
    config = SimpleNamespace(upscale=SimpleNamespace(upscaler='waifu', upscale_ratio=2))
    ctx = FakeCtx(img_colorized='COLORIZED')
    out = _run(st.run_upscaling(config, ctx, 'cuda'))
    assert out == 'UP0'                              # [0] unwrap preserved
    assert seen == {'upscaler': 'waifu', 'images': ['COLORIZED'], 'ratio': 2, 'device': 'cuda'}


# ---- run_colorizer: kwargs + the `**ctx` splat (landmine L15) ----

def test_run_colorizer_splats_ctx_and_forwards_kwargs(monkeypatch):
    seen = {}
    async def fake(colorizer, **kwargs):
        seen['colorizer'] = colorizer
        seen['kwargs'] = kwargs
        return 'COLORED'
    monkeypatch.setattr(st, 'dispatch_colorization', fake)
    config = SimpleNamespace(colorizer=SimpleNamespace(
        colorizer='mc2', colorization_size=576, denoise_sigma=30))
    ctx = FakeCtx(input='IMG', img_rgb='RGB')        # both keys must splat through
    out = _run(st.run_colorizer(config, ctx, 'cpu'))
    assert out == 'COLORED'
    assert seen['colorizer'] == 'mc2'
    # explicit kwargs present...
    assert seen['kwargs']['colorization_size'] == 576
    assert seen['kwargs']['denoise_sigma'] == 30
    assert seen['kwargs']['device'] == 'cpu'
    assert seen['kwargs']['image'] == 'IMG'
    # ...AND the whole ctx splatted in (L15) — img_rgb arrived via **ctx
    assert seen['kwargs']['img_rgb'] == 'RGB'


# ---- run_detection: 12 positional args, optional SFX 2nd pass (det_sfx) ----

def _det_config(det_sfx):
    return SimpleNamespace(detector=SimpleNamespace(
        detector='default', detection_size=2048, text_threshold=0.5, box_threshold=0.7,
        unclip_ratio=2.3, det_invert=False, det_gamma_correct=True, det_rotate=False,
        det_auto_rotate=True, det_sfx=det_sfx))


def test_run_detection_forwards_12_args_and_skips_sfx_when_off(monkeypatch):
    seen = {}
    async def fake_detect(*args):
        seen['args'] = args
        return 'DET'
    monkeypatch.setattr(st, 'dispatch_detection', fake_detect)
    monkeypatch.setattr(st, 'merge_sfx_detections', lambda *a: (_ for _ in ()).throw(AssertionError('sfx must not run when off')))
    ctx = FakeCtx(img_rgb='RGB')
    out = _run(st.run_detection(_det_config(False), ctx, 'cuda', True))
    assert out == 'DET'
    assert seen['args'] == ('default', 'RGB', 2048, 0.5, 0.7, 2.3, False, True, False, True, 'cuda', True)


def test_run_detection_runs_sfx_second_pass_when_on(monkeypatch):
    async def fake_detect(*args):
        return 'DET'
    seen = {}
    def fake_merge(ctx, result, device):
        seen.update(ctx_is=ctx, result=result, device=device)
        return 'DET+SFX'
    monkeypatch.setattr(st, 'dispatch_detection', fake_detect)
    monkeypatch.setattr(st, 'merge_sfx_detections', fake_merge)
    ctx = FakeCtx(img_rgb='RGB')
    out = _run(st.run_detection(_det_config(True), ctx, 'cuda', False))
    assert out == 'DET+SFX'
    assert seen == {'ctx_is': ctx, 'result': 'DET', 'device': 'cuda'}


# ---- run_mask_refinement: 8 positional args, no touch instrumentation ----

def test_run_mask_refinement_forwards_8_args(monkeypatch):
    seen = {}
    async def fake(*args):
        seen['args'] = args
        return 'MASK'
    monkeypatch.setattr(st, 'dispatch_mask_refinement', fake)
    config = SimpleNamespace(mask_dilation_offset=4, ocr=SimpleNamespace(ignore_bubble=0))
    ctx = FakeCtx(text_regions='TR', img_rgb='RGB', mask_raw='RAW')
    out = _run(st.run_mask_refinement(config, ctx, True, 3))
    assert out == 'MASK'
    assert seen['args'] == ('TR', 'RGB', 'RAW', 'fit_text', 4, 0, True, 3)


# ---- run_inpainting: 7 positional args, device + verbose threaded ----

def test_run_inpainting_forwards_7_args(monkeypatch):
    seen = {}
    async def fake(*args):
        seen['args'] = args
        return 'INP'
    monkeypatch.setattr(st, 'dispatch_inpainting', fake)
    inp = SimpleNamespace(inpainter='lama', inpainting_size=2048)
    config = SimpleNamespace(inpainter=inp)
    ctx = FakeCtx(img_rgb='RGB', mask='MASK')
    out = _run(st.run_inpainting(config, ctx, 'cuda', False))
    assert out == 'INP'
    assert seen['args'] == ('lama', 'RGB', 'MASK', inp, 2048, 'cuda', False)


# ---- run_text_rendering: three-way renderer branch (none / eng / default) ----

def _render_config(renderer):
    return SimpleNamespace(render=SimpleNamespace(
        renderer=renderer, line_spacing=1, font_size=24, font_size_offset=0,
        font_size_minimum=8, no_hyphenation=False, bubble_area_fit=True,
        supersampling=4, font_max_box_ratio=0.5))


def _render_ctx(target='THA'):
    return FakeCtx(img_inpainted='INP', img_rgb='RGB', render_mask='RMASK',
                   text_regions=[SimpleNamespace(target_lang=target)])


def test_run_rendering_none_returns_inpainted_without_dispatch(monkeypatch):
    monkeypatch.setattr(st, 'dispatch_rendering', lambda *a, **k: (_ for _ in ()).throw(AssertionError('no dispatch for Renderer.none')))
    out = _run(st.run_text_rendering(_render_config(Renderer.none), _render_ctx(), 'FONT'))
    assert out == 'INP'


def test_run_rendering_eng_pillow_when_horizontal(monkeypatch):
    seen = {}
    async def fake_pillow(*args):
        seen['args'] = args
        return 'ENG'
    monkeypatch.setattr(st, 'dispatch_eng_render_pillow', fake_pillow)
    monkeypatch.setattr(st, 'LANGUAGE_ORIENTATION_PRESETS', {'ENG': 'h'})
    out = _run(st.run_text_rendering(_render_config(Renderer.manga2EngPillow), _render_ctx('ENG'), 'FONT'))
    assert out == 'ENG'
    assert seen['args'] == ('INP', 'RGB', [seen['args'][2][0]], 'FONT', 1)


def test_run_rendering_default_dispatch_forwards_all_kwargs(monkeypatch):
    seen = {}
    async def fake_render(*args, **kwargs):
        seen.update(args=args, kwargs=kwargs)
        return 'RENDERED'
    monkeypatch.setattr(st, 'dispatch_rendering', fake_render)
    monkeypatch.setattr(st, 'LANGUAGE_ORIENTATION_PRESETS', {'THA': 'v'})
    ctx = _render_ctx('THA')
    out = _run(st.run_text_rendering(_render_config(Renderer.default), ctx, 'FONT'))
    assert out == 'RENDERED'
    # positional: img_inpainted, text_regions, font_path, font_size, offset, minimum, do_hyphenation, render_mask, line_spacing
    assert seen['args'] == ('INP', ctx.text_regions, 'FONT', 24, 0, 8, True, 'RMASK', 1)
    assert seen['kwargs'] == {'bubble_fit': True, 'supersampling': 4, 'font_max_box_ratio': 0.5}
