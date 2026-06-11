"""Lazy-instantiate-and-cache registry for the dispatch modules (#188 seam S22).

The detector / ocr / inpainter / upscaler / colorizer ``__init__`` modules each
carried the byte-identical ``get_X`` (lazy cache) + ``unload`` (pop) + cache-dict
trio, differing only in the registry dict, the cached type, and the noun in the
"not found" message. ``DispatchRegistry`` folds that trio into one place so each
module wires ``get_X = registry.get`` / ``unload = registry.unload`` and keeps its
own ``prepare`` / ``dispatch`` (those bodies genuinely diverge — different model
methods, signatures, and prepare-load behaviour — so they stay per-module).

Behaviour is preserved verbatim, including the ``if not cache.get(key)`` re-create
quirk and the ``','.join(registry)`` choice list in the error message.
"""


class DispatchRegistry:
    def __init__(self, registry, kind):
        """`registry`: {key: factory} (the module's `DETECTORS` / `OCRS` / …).
        `kind`: the noun used in the not-found message ("detector", "OCR", …)."""
        self._registry = registry
        self._kind = kind
        self._cache = {}

    def get(self, key, *args, **kwargs):
        if key not in self._registry:
            raise ValueError(f'Could not find {self._kind} for: "{key}". Choose from the following: %s' % ','.join(self._registry))
        if not self._cache.get(key):
            factory = self._registry[key]
            self._cache[key] = factory(*args, **kwargs)
        return self._cache[key]

    async def unload(self, key):
        self._cache.pop(key, None)
