"""Batch slots inside one worker (#1123), the pure parts: how many slots, and the gate around each request.

Strata-xeno serves several conversations from one engine and one copy of the weights (docs/BATCHING.md). MIT's
equivalent: one worker process per card handles N pages at once. GPU stages run inline and serialise on the event loop;
the remote LLM waits overlap. Measured on this PC (#1123): three worker processes sharing one card slowed detection
340 -> 867 ms and OCR 798 -> 1246 ms per page through CUDA-context contention, which one process per card avoids.

``MIT_WORKER_SLOTS`` (default 1 = one page at a time, exactly as before) needs ``MIT_PRELOAD=1``: two concurrent
requests must never race a first-time model load.
"""
import asyncio
import contextlib
import os

MAX_SLOTS = 8


def slots_from_env(env=None) -> int:
    env = env if env is not None else os.environ
    try:
        slots = int(str(env.get("MIT_WORKER_SLOTS", "")).strip())
    except ValueError:
        return 1
    preload = str(env.get("MIT_PRELOAD", "")).strip().lower() in ("1", "true", "yes", "on")
    if slots <= 1 or not preload:
        return 1
    return min(slots, MAX_SLOTS)


def effective_slots(env=None, context_size: int = 0) -> int:
    """Slots for a worker: one when it keeps rolling page context (context_size > 0), because translate() shares that
    translation memory across pages (#136 class); otherwise slots_from_env()."""
    return 1 if context_size and context_size > 0 else slots_from_env(env)


class SlotGate:
    """Shared holders run together; an exclusive holder waits for them and blocks new ones until it is done.

    A request that enables selective-Flux unloads shared models mid-page, so it runs exclusively; every other request
    holds the gate shared.
    """

    def __init__(self):
        self._cond = asyncio.Condition()
        self._shared = 0
        self._exclusive = False
        self._waiting_exclusive = 0

    @contextlib.asynccontextmanager
    async def hold(self, exclusive: bool):
        async with self._cond:
            if exclusive:
                self._waiting_exclusive += 1
                await self._cond.wait_for(lambda: not self._exclusive and self._shared == 0)
                self._waiting_exclusive -= 1
                self._exclusive = True
            else:
                await self._cond.wait_for(lambda: not self._exclusive and self._waiting_exclusive == 0)
                self._shared += 1
        try:
            yield
        finally:
            async with self._cond:
                if exclusive:
                    self._exclusive = False
                else:
                    self._shared -= 1
                self._cond.notify_all()
