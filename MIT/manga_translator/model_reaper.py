"""Model TTL reaper loop (#187 seam S20 / #188).

Wraps the usage tracker (S3) and unloader (S4) into the background TTL loop that was
``MangaTranslator._detector_cleanup_job``. ``reap_once`` is the testable single sweep;
``_loop`` polls it once per second.

- The ``ttl == 0`` short-circuit is preserved (idle: poll but never unload).
- The ``list(...)`` snapshot (L13) lives in ``tracker.expired`` (S3), so mid-sweep
  ``forget`` stays safe.
- ``stop()`` is **new and opt-in** — by default the task is never cancelled, preserving
  the L14 cleanup-task leak verbatim. It fixes the leak only when a caller invokes it.
"""
import asyncio
import time


class ModelReaper:
    def __init__(self, tracker, unloader, get_ttl):
        self._tracker = tracker
        self._unloader = unloader
        self._get_ttl = get_ttl
        self._task = None

    async def reap_once(self, now) -> None:
        """One TTL sweep: unload then forget each expired model. A ``ttl == 0`` returns
        immediately without querying ``expired`` — mirroring the loop's short-circuit."""
        ttl = self._get_ttl()
        if ttl == 0:
            return
        for tool, model in self._tracker.expired(ttl, now):
            await self._unloader.unload(tool, model)
            self._tracker.forget(tool, model)

    async def _loop(self) -> None:
        while True:
            await self.reap_once(time.time())
            await asyncio.sleep(1)

    def start(self):
        """Launch the polling task and return it (the call site keeps its idempotent
        ``is None`` guard)."""
        self._task = asyncio.create_task(self._loop())
        return self._task

    def ensure_started(self):
        """Idempotent start: launch the polling task only if it isn't running yet, and
        return it. Folds the call sites' ``if … is None: start()`` guard (L16)."""
        if self._task is None:
            self._task = asyncio.create_task(self._loop())
        return self._task

    def stop(self) -> None:
        """Cancel the polling task — opt-in; only fixes the L14 leak when called."""
        if self._task is not None:
            self._task.cancel()
