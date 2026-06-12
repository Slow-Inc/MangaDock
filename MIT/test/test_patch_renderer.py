"""Per-region patch-render orchestration (#187 seam S24b).

`PatchRenderer.process_group` is the nested closure lifted out of
`translate_patches`: crop → text-only mask → mask refinement → inpaint → render →
PNG encode, gated by a GPU semaphore, returning the byte-stable
`{x,y,w,h,img_png}` patch dict (the HTTP contract pickled at share.py:99). These
cases stub the driver's three GPU stages and drive the async path via
`asyncio.run`, pinning the patch-dict contract and the inpaint/render fallbacks.
Geometry runs for real on a tiny synthetic page; no ML stack is imported.
"""
import asyncio

import numpy as np

import manga_translator.patch_renderer as pr


class FakeRegion:
    def __init__(self, **attrs):
        for k, v in attrs.items():
            setattr(self, k, v)


class FakeDriver:
    """Supplies the three GPU stage coroutines; records call order."""
    def __init__(self, *, inpaint=None, render=None, mask=None):
        self.calls = []
        self._inpaint = inpaint
        self._render = render
        self._mask = mask

    async def _run_mask_refinement(self, config, patch_ctx):
        self.calls.append('mask')
        if self._mask is not None:
            return self._mask(patch_ctx)
        return None                                   # → text-only fallback mask

    async def _run_inpainting(self, config, patch_ctx):
        self.calls.append('inpaint')
        if self._inpaint is not None:
            return self._inpaint(patch_ctx)
        return patch_ctx.img_rgb                      # passthrough crop

    async def _run_text_rendering(self, config, patch_ctx):
        self.calls.append('render')
        if self._render is not None:
            return self._render(patch_ctx)
        return patch_ctx.img_rgb


class _Cfg:
    class render:
        bubble_area_fit = False
    class inpainter:
        inpaint_context_pad = 0                        # #249: tight crop (default)


def _ctx():
    img = np.full((200, 200, 3), 128, dtype=np.uint8)
    return type('C', (), {'img_rgb': img, 'mask_raw': None, 'mask': None})()


def _group():
    # xyxy (50,50,100,100); with pad=40 + render_extra=80 the crop expands to the
    # whole 200×200 page → deterministic x=0,y=0,w=200,h=200.
    return [FakeRegion(
        xyxy=(50, 50, 100, 100),
        lines=[[[50, 50], [100, 50], [100, 100], [50, 100]]],
        font_size=20,
    )]


def _renderer(driver):
    import logging
    return pr.PatchRenderer(
        driver, _ctx(), _Cfg,
        pad=40, render_extra=80, img_w=200, img_h=200,
        source_icc=None, sem=asyncio.Semaphore(3), logger=logging.getLogger('test'),
    )


def _run(coro):
    return asyncio.run(coro)


# ---- happy path: byte-stable {x,y,w,h,img_png} dict, stages run in order ------

def test_process_group_returns_patch_dict_and_runs_stages_in_order():
    driver = FakeDriver()
    result = _run(_renderer(driver).process_group(_group()))

    assert set(result) == {'x', 'y', 'w', 'h', 'img_png'}   # exact HTTP contract
    assert (result['x'], result['y'], result['w'], result['h']) == (0, 0, 200, 200)
    assert isinstance(result['img_png'], (bytes, bytearray)) and len(result['img_png']) > 0
    assert driver.calls == ['mask', 'inpaint', 'render']     # GPU stages in pipeline order


# ---- inpaint failure → fall back to the raw crop, still emit a patch ----------

def test_process_group_inpaint_failure_falls_back_to_crop():
    def boom(_patch_ctx):
        raise RuntimeError('lama OOM')
    driver = FakeDriver(inpaint=boom)
    result = _run(_renderer(driver).process_group(_group()))

    assert set(result) == {'x', 'y', 'w', 'h', 'img_png'}    # still a valid patch
    assert len(result['img_png']) > 0
    assert driver.calls == ['mask', 'inpaint', 'render']      # render still runs after fallback


# ---- render failure → fall back to the inpainted crop, still emit a patch -----

def test_process_group_render_failure_falls_back_to_inpaint():
    def boom(_patch_ctx):
        raise RuntimeError('font load failed')
    driver = FakeDriver(render=boom)
    result = _run(_renderer(driver).process_group(_group()))

    assert set(result) == {'x', 'y', 'w', 'h', 'img_png'}
    assert len(result['img_png']) > 0
    assert driver.calls == ['mask', 'inpaint', 'render']


# ---- #249: larger inpaint context crop, render rect sliced back unchanged ------

def test_process_group_inpaint_context_pad_enlarges_crop_then_slices_back():
    """With inpaint_context_pad>0 the inpainter sees a crop padded on every side,
    but the emitted patch position/size stays the render rect (result sliced back)."""
    import logging
    seen = {}

    def record(patch_ctx):
        seen['inpaint_shape'] = patch_ctx.img_rgb.shape
        return patch_ctx.img_rgb                       # passthrough the larger crop
    driver = FakeDriver(inpaint=record)

    class Cfg:
        class render:
            bubble_area_fit = False
        class inpainter:
            inpaint_context_pad = 100

    page = np.full((600, 600, 3), 128, dtype=np.uint8)
    ctx = type('C', (), {'img_rgb': page, 'mask_raw': None, 'mask': None})()
    group = [FakeRegion(
        xyxy=(250, 250, 300, 300),
        lines=[[[250, 250], [300, 250], [300, 300], [250, 300]]],
        font_size=20,
    )]
    renderer = pr.PatchRenderer(
        driver, ctx, Cfg, pad=40, render_extra=80, img_w=600, img_h=600,
        source_icc=None, sem=asyncio.Semaphore(3), logger=logging.getLogger('test'),
    )
    result = _run(renderer.process_group(group))

    # render rect = xyxy ±pad ±render_extra = (130,130,420,420) → 290×290
    assert (result['x'], result['y'], result['w'], result['h']) == (130, 130, 290, 290)
    # inpaint saw that rect padded by 100 on each side (clamped to the 600px page) → 490×490
    assert seen['inpaint_shape'] == (490, 490, 3)
