"""Shared until-translation pipeline block (#187 seam S25).

`_translate` and `_translate_until_translation` ran the identical colorize →
upscale → detect → ocr → textline_merge → pre-dict sequence; S25 folds it into
`_run_until_translation_stages(ctx, config) -> (ctx, finished)`. `finished=True`
means an early-exit fired (no regions / no text) and `ctx` is the final reverted
result; `finished=False` means continue to translation. These cases pin that
contract — stage order, the (ctx, finished) tuple, and the early-exit revert —
by driving the method (unbound) on a fake driver with stubbed `_run_stage`. No
ML stack; the async path runs via `asyncio.run`.
"""
import asyncio
import types

import pytest

import manga_translator.manga_translator as mt


def _run(coro):
    return asyncio.run(coro)


class FakeDriver:
    """Records stage names + progress so the ordered flow is assertable."""
    def __init__(self, stage_returns, verbose=False):
        self.verbose = verbose
        self._result_path = 'rp'
        self.pre_dict = None
        self._stage_returns = stage_returns
        self.events = []
        self.reverted = False

    async def _run_stage(self, name, fn, fallback):
        self.events.append(name)
        return self._stage_returns[name]

    async def _report_progress(self, state, finished=False):
        self.events.append(f'progress:{state}')

    async def _revert_upscale(self, config, ctx):
        self.reverted = True
        return ctx


def _config():
    # colorizer none + upscale_ratio 0 → both stages skipped (no _run_stage call)
    return types.SimpleNamespace(
        colorizer=types.SimpleNamespace(colorizer=mt.Colorizer.none),
        upscale=types.SimpleNamespace(upscale_ratio=0),
    )


def _ctx():
    return types.SimpleNamespace(input='INPUT')


@pytest.fixture(autouse=True)
def _patch_module(monkeypatch):
    monkeypatch.setattr(mt, 'load_image', lambda up: ('RGB', 'ALPHA'))
    monkeypatch.setattr(mt, 'load_dictionary', lambda pd: {})
    monkeypatch.setattr(mt, 'apply_dictionary', lambda text, d: text)


def _call(driver, ctx, config):
    return _run(mt.MangaTranslator._run_until_translation_stages(driver, ctx, config))


# ---- happy path: regions survive → (ctx, finished=False), no revert -----------

def test_until_stages_happy_path_returns_not_finished():
    region = types.SimpleNamespace(text='hi')
    driver = FakeDriver({
        'detection': (['tl'], None, None),
        'ocr': ['tl'],
        'textline_merge': [region],
    })
    ctx = _ctx()
    out_ctx, finished = _call(driver, ctx, _config())

    assert finished is False
    assert out_ctx is ctx
    assert ctx.text_regions == [region]
    assert ctx.img_rgb == 'RGB' and ctx.img_alpha == 'ALPHA'   # load_image wired
    assert driver.events == ['detection', 'ocr', 'textline_merge']  # colorize/upscale skipped
    assert driver.reverted is False


# ---- no detections → early-exit: reverts + (ctx, finished=True) ---------------

def test_until_stages_skip_no_regions_finishes_and_reverts():
    driver = FakeDriver({'detection': ([], None, None)})
    ctx = _ctx()
    out_ctx, finished = _call(driver, ctx, _config())

    assert finished is True
    assert out_ctx is ctx
    assert ctx.result == ctx.upscaled                          # intermediate result set pre-revert
    assert driver.reverted is True
    assert driver.events == ['detection', 'progress:skip-no-regions']


# ---- detections but empty OCR → early-exit at the no-text gate ----------------

def test_until_stages_skip_no_text_finishes_and_reverts():
    driver = FakeDriver({'detection': (['tl'], None, None), 'ocr': []})
    ctx = _ctx()
    out_ctx, finished = _call(driver, ctx, _config())

    assert finished is True
    assert driver.reverted is True
    assert driver.events == ['detection', 'ocr', 'progress:skip-no-text']
