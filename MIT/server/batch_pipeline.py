"""Cross-page stage pipelining for batch translation (#905).

The batch runner submits one page at a time to a worker, which serialises the whole page pipeline, so the
gateway wait (translation, 39-63 % of wall) leaves the GPU idle. This loop runs pages inside one process:
page i+1's *front* stages (detect/ocr/merge) start while page i's translation is in flight, and page i's
*back* stages (mask/inpaint/render) run while page i+1 translates.

Translation itself stays strictly ordered — the #159 rolling ``prev_context`` needs page i's translated
dialogue before page i+1 can be translated, so this module never overlaps translations.

All heavy work is injected, so ordering/overlap/cancellation are unit-testable without the ML stack (same
rationale as ``server/batch_runner.py``, Issue #100).
"""
import asyncio


async def _value(fn):
    """Call ``fn`` and await it when it returned an awaitable (cancel checks may be sync or async)."""
    out = fn()
    if asyncio.iscoroutine(out):
        out = await out
    return out


async def run_pipelined(pages, *, prepare_front, translate, finish_back, cancel_check=None):
    """Run ``pages`` through a two-slot pipeline; returns results in page order.

    prepare_front(page) -> front state (GPU: detect/ocr/merge)
    translate(front, prev_context) -> {'translation': ..., 'block': <context for the next page>}
    finish_back(page, front, translated) -> result payload (GPU: mask/inpaint/render)

    ``cancel_check()`` is polled before each new page (between pages, like batch_runner).
    """
    if not pages:
        return []

    results = [None] * len(pages)
    back_tasks = []
    front_task = asyncio.create_task(prepare_front(pages[0]))
    prev_context = None

    for i, page in enumerate(pages):
        if cancel_check is not None and await _value(cancel_check):
            front_task.cancel()
            break

        front = await front_task
        next_front = None
        if i + 1 < len(pages):
            # Start the next page's GPU front stages BEFORE this page's gateway wait, so they overlap.
            next_front = asyncio.create_task(prepare_front(pages[i + 1]))

        translated = await translate(front, prev_context)
        prev_context = translated.get('block')
        # Back stages run concurrently with the next page's translation; collect them in order below.
        back_tasks.append(asyncio.create_task(finish_back(page, front, translated)))
        front_task = next_front

    for i, task in enumerate(back_tasks):
        results[i] = await task
    # A cancelling batch keeps the pages it already finished; the rest never started.
    return [r for r in results if r is not None]
