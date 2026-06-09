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
                 cuda_available: Callable[[], bool]):
        self._routes = routes
        self._empty_cache = empty_cache
        self._cuda_available = cuda_available

    async def unload(self, tool: str, model: str) -> None:
        """Run ``tool``'s unload fn (if the table has one) then ``empty_cache`` when
        CUDA is available — mirroring the original method verbatim, including the
        unknown-key no-op that preserves the L1 key drift."""
        logger.info(f"Unloading {tool} model: {model}")
        unload_fn = self._routes.get(tool)
        if unload_fn is not None:
            await unload_fn(model)
        if self._cuda_available():
            self._empty_cache()
