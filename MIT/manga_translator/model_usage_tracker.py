"""Model-usage TTL bookkeeping (#187 seam S3 / #188 starts here).

Wraps the bare ``_model_usage_timestamps`` dict that MangaTranslator stamped from
eight inline sites and swept in ``_detector_cleanup_job``: records when each
``(tool, model)`` was last used and reports which have expired. The clock is injected
(``now`` is passed in) so the TTL sweep is testable without the ML stack.

Deliberately does **not** normalise keys — the L1 key-drift landmine (``'colorizer'``
never matching ``_unload_model``'s ``case 'colorization'``; ``'textline_merge'`` /
``'rendering'`` having no case) is owned by the call sites and preserved verbatim.
"""
from typing import List, Tuple


class ModelUsageTracker:
    def __init__(self):
        self._timestamps = {}

    def touch(self, tool: str, model: str, now: float) -> None:
        """Record ``(tool, model)`` as last used at ``now``."""
        self._timestamps[(tool, model)] = now

    def expired(self, ttl: float, now: float) -> List[Tuple[str, str]]:
        """Return the keys whose last use is older than ``ttl`` (strict ``> ttl``),
        in insertion order over a ``list(...)`` snapshot — mirroring the original
        ``for (tool, model), last_used in list(self._model_usage_timestamps.items())``
        sweep so it is safe to ``forget`` during iteration of the returned list."""
        return [key for key, last_used in list(self._timestamps.items())
                if now - last_used > ttl]

    def forget(self, tool: str, model: str) -> None:
        """Drop ``(tool, model)`` after it has been unloaded (mirrors the
        ``del self._model_usage_timestamps[(tool, model)]`` in the sweep)."""
        del self._timestamps[(tool, model)]
