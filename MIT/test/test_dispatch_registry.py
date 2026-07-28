"""Lazy-instantiate-and-cache dispatch registry (#188 seam S22).

The detector / ocr / inpainter / upscaler / colorizer `__init__` modules each
repeated the identical `get_X` (lazy cache) + `unload` (pop) + cache-dict quintet;
`DispatchRegistry` collapses it. `prepare` / `dispatch` stay per-module (their
bodies diverge — different methods, args, prepare-load behaviour). These cases
pin the cache / error-message / unload behaviour so the 5-module swap is
byte-identical. The async path runs via `asyncio.run`.
"""
import asyncio

import pytest

import manga_translator.dispatch_registry as dr


def _run(coro):
    return asyncio.run(coro)


class Fake:
    instances = 0

    def __init__(self, *args, **kwargs):
        Fake.instances += 1
        self.args = args
        self.kwargs = kwargs


def _registry():
    Fake.instances = 0
    return dr.DispatchRegistry({'a': Fake}, 'widget')


# ---- get: lazy-instantiate once, then return the cached instance --------------

def test_get_lazy_instantiates_and_caches():
    reg = _registry()
    first = reg.get('a')
    second = reg.get('a')
    assert first is second                # same cached instance
    assert Fake.instances == 1            # factory invoked exactly once


def test_get_forwards_args_and_kwargs_to_factory():
    reg = _registry()
    inst = reg.get('a', 1, 2, x=3)
    assert inst.args == (1, 2)
    assert inst.kwargs == {'x': 3}


# ---- get: unknown key → ValueError with the exact message format -------------

def test_get_unknown_key_raises_valueerror_with_kind_and_choices():
    reg = dr.DispatchRegistry({'a': Fake, 'b': Fake}, 'widget')
    with pytest.raises(ValueError) as e:
        reg.get('zzz')
    msg = str(e.value)
    assert 'Could not find widget for: "zzz"' in msg
    assert 'Choose from the following: a,b' in msg     # ','.join(registry keys)


# ---- unload: pop the cache so the next get re-instantiates --------------------

def test_unload_pops_cache_so_next_get_reinstantiates():
    reg = _registry()
    reg.get('a')
    _run(reg.unload('a'))
    reg.get('a')
    assert Fake.instances == 2            # re-instantiated after unload


def test_unload_unknown_key_is_a_noop():
    reg = _registry()
    _run(reg.unload('zzz'))               # pop(default) — no error


# ---- unload: run the model's own cleanup (frees VRAM) before popping ----------

def test_unload_awaits_the_instance_unload_before_popping():
    # #421 VRAM leak: FluxKleinInpainter._unload dels the pipeline + empty_cache,
    # but the registry only popped the cache ref (never awaited unload) → VRAM leaked.
    events = []
    class Model:
        def __init__(self, *a, **k):
            pass
        async def unload(self):
            events.append('cleanup')
    reg = dr.DispatchRegistry({'m': Model}, 'widget')
    inst = reg.get('m')
    _run(reg.unload('m'))
    assert events == ['cleanup']              # the model's own VRAM cleanup ran
    assert reg.get('m') is not inst           # and the cache was popped (new instance)


def test_unload_tolerates_instance_without_unload_method():
    # models with no unload() (the Fake) are still popped, no error
    reg = _registry()
    reg.get('a')
    _run(reg.unload('a'))
    assert Fake.instances == 1                # popped; re-get would re-instantiate
    reg.get('a')
    assert Fake.instances == 2
