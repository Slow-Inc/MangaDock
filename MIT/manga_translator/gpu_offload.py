"""Model forwards off the event loop for worker slots (#1123), pure and torch-free.

In a slot worker several pages share one asyncio loop, and every model forward (detection, OCR, inpainting, ...) is
synchronous torch/cv2 code under an ``async def _infer``: while one page's OCR runs, no other page can handle its LLM
answer or run its post-translation stages. ``run`` executes the forward coroutine on its own loop in a worker thread so
the main loop stays free.

Forwards still run one at a time: a process-wide lock keeps the GPU single-tenant, because the 48px OCR turns cuDNN off
around its forward and that flag is process-global (a concurrent LaMa forward would run without cuDNN, 3-12x slower;
model_48px.py), and two inpainting forwards would double VRAM. Off by default; the worker enables it with slots > 1.
Translators never offload (their _infer awaits HTTP clients bound to the main loop).
"""
import asyncio
import threading

_enabled = False
_gpu = threading.Lock()


def set_enabled(value: bool) -> None:
    global _enabled
    _enabled = bool(value)


def enabled() -> bool:
    return _enabled


def _run_locked(make_coro):
    with _gpu:
        return asyncio.run(make_coro())


async def run(make_coro):
    """Await ``make_coro()`` - inline, or in a thread under the GPU lock when offload is enabled."""
    if not _enabled:
        return await make_coro()
    return await asyncio.to_thread(_run_locked, make_coro)
