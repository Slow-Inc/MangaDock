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


# ---- full-page inpaint reuse: clean background, skip per-crop mask + inpaint -----

def test_process_group_full_page_inpaint_skips_per_crop_mask_and_inpaint():
    """When a full-page inpaint is supplied, each group slices its clean background
    from it and SKIPS the per-crop mask refinement + inpaint — those starve LaMa of
    page context and leave a gray blob where large text sat over complex/dark art."""
    import logging
    seen = {}

    def record_render(patch_ctx):
        seen['bg'] = patch_ctx.img_rgb.copy()
        return patch_ctx.img_rgb
    driver = FakeDriver(render=record_render)
    full = np.full((200, 200, 3), 77, dtype=np.uint8)       # distinct clean background

    renderer = pr.PatchRenderer(
        driver, _ctx(), _Cfg, pad=40, render_extra=80, img_w=200, img_h=200,
        source_icc=None, sem=asyncio.Semaphore(3), logger=logging.getLogger('test'),
        full_inpainted=full,
    )
    result = _run(renderer.process_group(_group()))

    assert driver.calls == ['render']                        # no 'mask', no 'inpaint'
    assert int(seen['bg'].mean()) == 77                      # bg is the full-page inpaint slice
    assert set(result) == {'x', 'y', 'w', 'h', 'img_png'}


# ---- #268: luminance re-ground pulls the masked inpaint toward the local surround ----

def test_process_group_regrounds_inpaint_when_knob_on():
    """With lama_lum_reground>0 the inpaint's masked region is pulled toward the local
    original surround before the text is drawn; off → the inpaint level is left as-is."""
    import logging

    def dark_inpaint(patch_ctx):
        # simulate a LaMa fill ~30 levels off the 130 surround across the crop
        return np.full_like(patch_ctx.img_rgb, 100)

    def make(strength):
        seen = {}
        driver = FakeDriver(inpaint=dark_inpaint,
                            render=lambda pctx: (seen.__setitem__('r', pctx.img_rgb.copy()), pctx.img_rgb)[1])

        class Cfg:
            class render:
                bubble_area_fit = False
                patch_feather_radius = 0
            class inpainter:
                inpaint_context_pad = 0
                full_page_inpaint = False
                lama_lum_reground = strength
        page = np.full((200, 200, 3), 130, np.uint8)
        ctx = type('C', (), {'img_rgb': page, 'mask_raw': None, 'mask': None})()
        renderer = pr.PatchRenderer(
            driver, ctx, Cfg, pad=40, render_extra=80, img_w=200, img_h=200,
            source_icc=None, sem=asyncio.Semaphore(3), logger=logging.getLogger('test'))
        _run(renderer.process_group(_group()))
        return seen['r'][60:90, 60:90].mean()          # the masked text region

    assert make(0.0) < 105                              # off → stays at the ~100 fill
    assert make(1.0) > 118                              # on  → pulled toward the 130 surround


# ---- #250: page-scaled font floor applied on a per-request config copy ---------

def test_patch_renderer_floors_font_min_to_page_scale_on_a_config_copy():
    """#250: the renderer floors font_size_minimum to the PAGE-scaled value, on a
    deep copy — the input config (shared / full-page path) is never mutated."""
    import types

    original = types.SimpleNamespace(
        render=types.SimpleNamespace(bubble_area_fit=False, font_size_minimum=-1),
        inpainter=types.SimpleNamespace(inpaint_context_pad=0),
    )
    renderer = pr.PatchRenderer(
        FakeDriver(), _ctx(), original, pad=40, render_extra=80,
        img_w=1400, img_h=2000, source_icc=None,
        sem=asyncio.Semaphore(3), logger=__import__('logging').getLogger('test'),
    )
    assert renderer.config.render.font_size_minimum == 17    # round((2000+1400)/200)
    assert original.render.font_size_minimum == -1           # input untouched (per-request copy)


def test_patch_renderer_keeps_a_larger_explicit_font_min():
    """An explicit floor already above the page scale is preserved (and no needless copy)."""
    import types

    original = types.SimpleNamespace(
        render=types.SimpleNamespace(bubble_area_fit=False, font_size_minimum=40),
        inpainter=types.SimpleNamespace(inpaint_context_pad=0),
    )
    renderer = pr.PatchRenderer(
        FakeDriver(), _ctx(), original, pad=40, render_extra=80,
        img_w=1400, img_h=2000, source_icc=None,
        sem=asyncio.Semaphore(3), logger=__import__('logging').getLogger('test'),
    )
    assert renderer.config.render.font_size_minimum == 40    # 40 > page floor 17 → kept


# ---- #535 Phase-0b wiring: the erase mask is guarded to the group's own regions ----
# The refined mask hunts ALL text-like strokes in the crop — including a dropped
# region's text or a neighbouring group's bubble. Erasing those without re-rendering
# = the empty-white-bubble defect. After refinement the mask must be restricted to
# the regions this patch actually renders.

def test_refined_mask_strokes_outside_group_regions_are_guarded_away():
    seen = {}

    def refined(patch_ctx):
        m = np.zeros(patch_ctx.img_rgb.shape[:2], np.uint8)
        m[60:90, 60:90] = 255       # strokes inside the group's region → erased (ok)
        m[150:170, 150:170] = 255   # foreign strokes (dropped/other-group text) → must NOT be erased
        return m

    def inpaint(patch_ctx):
        seen['mask'] = patch_ctx.mask.copy()
        return patch_ctx.img_rgb

    driver = FakeDriver(mask=refined, inpaint=inpaint)
    asyncio.run(_renderer(driver).process_group(_group()))

    assert seen['mask'][75, 75] == 255      # in-region erase survives
    assert seen['mask'][160, 160] == 0      # foreign strokes protected (no erase-without-render)


# ---- #535 Phase-0c: render telemetry stamped on LOCAL copies flows back to originals ----
# resize_regions runs on build_local_region deepcopies inside the patch group; the
# /patches payload reads the ORIGINAL regions — so telemetry must be copied back.

def test_render_telemetry_copied_back_to_original_regions():
    def render(patch_ctx):
        for lr in patch_ctx.text_regions:      # simulate dispatch stamping the local copy
            lr.render_branch = 'clean_layout'
            lr.render_font_px = 20
            lr.render_dst_box = (1.0, 2.0, 3.0, 4.0)
        return patch_ctx.img_rgb

    group = _group()
    asyncio.run(_renderer(FakeDriver(render=render)).process_group(group))

    assert getattr(group[0], 'render_branch', None) == 'clean_layout'
    assert getattr(group[0], 'render_font_px', None) == 20
    assert getattr(group[0], 'render_dst_box', None) == (1.0, 2.0, 3.0, 4.0)
