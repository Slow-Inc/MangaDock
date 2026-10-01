"""Model-unload routing (#187 seam S4 / #188).

Replaces the ``match tool:`` block in ``MangaTranslator._unload_model`` with an
injected ``{tool: async unload_fn}`` table plus an ``empty_cache`` hook. The table is
keyed by the **unload-side** names (``'colorization'``, ``'detection'``, …); an unknown
key — including the L1-drifted ``'colorizer'`` / ``'textline_merge'`` / ``'rendering'``
that the usage tracker stamps — matches nothing and only triggers ``empty_cache``,
exactly as the original ``match/case`` did. Routes + cache hooks are injected so the
module pulls in no ML stack of its own.
"""
import logging
from typing import Awaitable, Callable, Dict

logger = logging.getLogger('manga_translator')


class ModelUnloader:
    def __init__(self, routes: Dict[str, Callable[[str], Awaitable[None]]], *,
                 empty_cache: Callable[[], None],
                 cuda_available: Callable[[], bool],
                 read_vram: Callable[[], "int | None"] | None = None,
                 vram_tracker=None):
        self._routes = routes
        self._empty_cache = empty_cache
        self._cuda_available = cuda_available
        # Dev-console VRAM leak detection (#279): `read_vram` returns the worker's torch
        # allocated MB; `vram_tracker` (VramTracker) records how much each unload frees.
        self._read_vram = read_vram
        self._vram_tracker = vram_tracker

    async def unload(self, tool: str, model: str) -> None:
        """Run ``tool``'s unload fn (if the table has one) then ``empty_cache`` when
        CUDA is available — mirroring the original method verbatim, including the
        unknown-key no-op that preserves the L1 key drift. When a VRAM tracker is wired,
        also measure how much VRAM the unload actually freed (freed ≈ 0 while resident =
        the leak the dev hunts)."""
        logger.info(f"Unloading {tool} model: {model}")
        before = self._read_vram() if self._read_vram is not None else None
        unload_fn = self._routes.get(tool)
        if unload_fn is not None:
            await unload_fn(model)
        if self._cuda_available():
            self._empty_cache()
        if before is not None and self._vram_tracker is not None:
            after = self._read_vram()
            if after is not None:
                self._vram_tracker.on_unload(tool, max(0, before - after))
