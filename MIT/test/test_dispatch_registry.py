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
