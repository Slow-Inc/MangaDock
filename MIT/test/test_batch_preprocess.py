"""Batch pre-process MemoryError ladder (#187 seam S26b).

`_preprocess_image_for_batch` is the per-image try/MemoryError/Exception ladder
lifted out of `translate_batch`'s pre-processing loop. It runs
`_translate_until_translation` and returns the `(ctx, config)` pair the caller
appends: on success the real ctx; on MemoryError a `release_memory` +
deepcopy-config retry (or re-raise when memory optimization is off); on retry
failure or any other error a placeholder Context. These cases drive the method
(unbound) on a fake driver with a scripted `_translate_until_translation`, so the
fallback ladder is pinned without the ML stack. Async path via `asyncio.run`.
"""
import asyncio
import types

import pytest

import manga_translator.manga_translator as mt


CFG = types.SimpleNamespace(name='cfg')


def _call(driver, image, config, i, mem_opt):
    return asyncio.run(
        mt.MangaTranslator._preprocess_image_for_batch(driver, image, config, i, mem_opt))


class FakeDriver:
    """Scripts `_translate_until_translation` from a list of values/exceptions."""
    def __init__(self, until, *, verbose=False, debug_current=None):
        self.verbose = verbose
        self._image_debug = types.SimpleNamespace(current=debug_current)
        self._until = list(until)
        self.until_calls = []
        self.set_ctx_calls = []
        self.saved = []

    def _set_image_context(self, config, image):
        self.set_ctx_calls.append((config, image))

    def _save_current_image_context(self, md5):
        self.saved.append(md5)

    async def _translate_until_translation(self, image, config):
        self.until_calls.append((image, config))
        r = self._until.pop(0)
        if isinstance(r, BaseException):
            raise r
        return r


@pytest.fixture
def released(monkeypatch):
    calls = []
    monkeypatch.setattr(mt, 'release_memory', lambda *a, **k: calls.append(a))
    return calls


# ---- success: real ctx + config, verbose + image_context stamped -------------

def test_preprocess_success_returns_ctx_and_config(released):
    ctx = types.SimpleNamespace()
    d = FakeDriver([ctx], verbose=True, debug_current={'file_md5': 'abc'})
    out_ctx, out_cfg = _call(d, 'IMG', CFG, 0, True)

    assert out_ctx is ctx and out_cfg is CFG
    assert ctx.verbose is True
    assert ctx.image_context == {'file_md5': 'abc'}      # copied from _image_debug.current
    assert d.saved == ['abc']                            # _save_current_image_context(md5)
    assert d.set_ctx_calls == [(CFG, 'IMG')]
    assert len(d.until_calls) == 1
    assert released == []                                # no memory release on the happy path


# ---- MemoryError → release + deepcopy-config retry succeeds -------------------

def test_preprocess_memoryerror_falls_back_with_recovery_config(released):
    ctx2 = types.SimpleNamespace()
    d = FakeDriver([MemoryError('oom'), ctx2], verbose=False, debug_current=None)
    out_ctx, out_cfg = _call(d, 'IMG', CFG, 1, True)

    assert out_ctx is ctx2
    assert out_cfg is not CFG                            # recovery_config = deepcopy(config)
    assert out_cfg.name == 'cfg'                         # ...but same content
    assert len(d.until_calls) == 2                       # original + fallback retry
    assert d.until_calls[1][1] is out_cfg                # retry ran on the recovery config
    assert len(released) == 1                            # forced cleanup before retry
    assert ctx2.verbose is False


# ---- MemoryError → retry also fails → placeholder + original config ----------

def test_preprocess_fallback_failure_returns_placeholder(released):
    d = FakeDriver([MemoryError('oom'), RuntimeError('still bad')], debug_current=None)
    out_ctx, out_cfg = _call(d, 'IMG', CFG, 2, True)

    assert out_ctx.input == 'IMG'
    assert out_ctx.text_regions == []                    # placeholder shape
    assert out_cfg is CFG                                # original config, not the recovery copy


# ---- non-memory error → placeholder (no fallback retry) ----------------------

def test_preprocess_generic_error_returns_placeholder(released):
    d = FakeDriver([ValueError('boom')], debug_current=None)
    out_ctx, out_cfg = _call(d, 'IMG', CFG, 0, True)

    assert out_ctx.input == 'IMG'
    assert out_ctx.text_regions == []
    assert out_cfg is CFG
    assert released == []                                # generic path doesn't release


# ---- MemoryError with optimization OFF → re-raise (no fallback) --------------

def test_preprocess_memoryerror_reraises_when_optimization_disabled(released):
    d = FakeDriver([MemoryError('oom')], debug_current=None)
    with pytest.raises(MemoryError):
        _call(d, 'IMG', CFG, 0, False)
    assert len(d.until_calls) == 1                        # no fallback attempt
