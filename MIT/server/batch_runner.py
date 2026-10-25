"""Background batch loop for webhook-mode batch translation.

Extracted from ``server/main.py`` so the cancellation semantics around the loop
are unit-testable without importing the ML stack — same rationale as
``server/webhook.py`` (Issue #100). The only heavy work (config parse + the
translation pipeline) sits behind ``_translate_page``, whose imports are
deferred to call time.
"""
import asyncio
import os

from server.cancellation import is_cancelled, discard
from server.patch_payload import normalize_patch_result
from server.rolling_context import RollingContext
from server.webhook import send_webhook


def batch_slots(env=None) -> int:
    """#1119: pages translated at once when they do not depend on each other (Strata batch slots).

    One per worker (MIT_WORKERS), or MIT_BATCH_CONCURRENCY when set; at least 1. A single worker
    therefore keeps today's one-page-at-a-time loop.
    """
    from server.worker_plan import parse_worker_count
    env = env if env is not None else os.environ
    override = str(env.get('MIT_BATCH_CONCURRENCY', '') or '').strip()
    if override:
        try:
            return max(1, int(override))
        except ValueError:
            pass
    return parse_worker_count(env.get('MIT_WORKERS'))


def _env_int(name: str, default: int) -> int:
    """Read a non-negative int env var, falling back on absent / blank / invalid."""
    try:
        return max(0, int(os.environ.get(name, '') or default))
    except ValueError:
        return default


async def _translate_page(config_str: str, img_bytes: bytes, progress_meta: dict | None = None,
                          prev_context: str | None = None) -> dict:
    """Run a single page through the translation pipeline.

    Heavy imports are deferred so importing this module stays fast for tests.
    The config is re-parsed per page to avoid any state mutation across pages.
    `prev_context` (#159) seeds this page's GPT-family translators with the Batch
    Job's rolling cross-page context; absent → unchanged.
    """
    from manga_translator.config import parse_and_validate_config
    from server.request_extraction import get_patch_ctx

    # Dummy request mock for internal pipeline compatibility
    class DummyRequest:
        async def is_disconnected(self):
            return False

    page_conf = parse_and_validate_config(config_str)
    if prev_context:
        page_conf.translator.prev_context = prev_context
    return await get_patch_ctx(DummyRequest(), page_conf, img_bytes, progress_meta=progress_meta)




def _pipeline_enabled() -> bool:
    """#905 opt-in: run the batch on one worker with the page phases overlapped."""
    return str(os.environ.get('MIT_BATCH_PIPELINE', '') or '').strip().lower() in ('1', 'true', 'yes', 'on')


def _load_pipeline_deps():
    """Deferred so this module stays ML-free unless the opt-in path is actually used."""
    from PIL import Image

    from manga_translator.config import parse_and_validate_config
    from server.instance import executor_instances

    return Image, parse_and_validate_config, executor_instances


async def _run_batch_pipelined(index_list, images_data, config_str, taskId, callback_url, callback_secret,
                               deps=None):
    """#905: translate the whole batch on one worker, then deliver the per-page webhooks.

    The worker runs MangaTranslator.translate_batch_pipelined, which keeps the translation order and the
    #159 rolling context but overlaps each page's GPU phases with the neighbouring page's gateway wait.
    Cancellation is honoured before the batch starts and before each delivered page (the worker cannot read
    the server's cancel registry mid-batch, so a cancel that lands mid-batch drops the remaining deliveries).
    """
    Image, parse_config, executors = deps if deps is not None else _load_pipeline_deps()
    from io import BytesIO

    images = [Image.open(BytesIO(b)).convert('RGB') for b in images_data]
    config = parse_config(config_str)

    raw_results = None
    error = None
    executor = await executors.find_executor()
    try:
        raw_results = await executor.sent_batch_pipeline(images, config)
    except Exception as exc:  # the whole batch failed: report it per page like the serial path
        error = str(exc)
    finally:
        await executors.free_executor(executor)

    for pos, page_idx in enumerate(index_list):
        if is_cancelled(taskId):
            print(f"[batch] task {taskId} cancelled - stopping before page {page_idx}")
            break
        if error is not None:
            payload = {
                "taskId": taskId,
                "pageIndex": page_idx,
                "imgWidth": 0,
                "imgHeight": 0,
                "patches": [],
                "error": error,
            }
        else:
            normalized = normalize_patch_result(raw_results[pos])
            payload = {
                "taskId": taskId,
                "pageIndex": page_idx,
                "imgWidth": normalized["img_width"],
                "imgHeight": normalized["img_height"],
                "patches": normalized["patches"],
                "regions": normalized["regions"],
                "error": None,
            }
        if is_cancelled(taskId):
            print(f"[batch] task {taskId} cancelled - dropping page {page_idx} result")
            break
        await send_webhook(callback_url, callback_secret, payload)

async def run_batch_with_callbacks(
    index_list: list[int],
    images_data: list[bytes],
    config_str: str,
    taskId: str,
    callback_url: str,
    callback_secret: str,
):
    """Background task to process images and send webhooks.

    Polls the cancellation registry between pages: a cancelled Batch Job stops
    starting new pages, and a page that finished after the cancellation arrived
    is not delivered. The taskId is discarded on exit so the registry stays small.

    taskIds are deterministic per chapter+language pair, so a fresh run starts by
    discarding any stale cancel flag — one left by a cancel that arrived after the
    previous run of this taskId had already finished (Issue #128). Only cancels
    arriving while this run is in flight apply to it.
    """
    discard(taskId)
    # #159: a Batch Job's local Translation Session — recent pages' translated dialogue
    # seeds the next page's prompt for cross-page name/pronoun consistency. The memory is
    # born and dies with this loop (the worker still resets per request, so the #136 bleed
    # class stays structurally impossible). MIT_CONTEXT_PAGES=0 (default) disables it →
    # no prev_context is ever injected → byte-identical to today.
    rolling = RollingContext(
        max_pages=_env_int('MIT_CONTEXT_PAGES', 0),
        max_chars=_env_int('MIT_CONTEXT_MAX_CHARS', 1500),
    )
    try:
        if _pipeline_enabled():
            await _run_batch_pipelined(index_list, images_data, config_str, taskId,
                                       callback_url, callback_secret)
            return
        pages = list(zip(images_data, index_list))
        slots = batch_slots()
        if slots > 1 and rolling.max_pages == 0:
            # #1119: no cross-page context -> pages are independent; run one per worker and deliver
            # each webhook as it completes (the Backend keys results by pageIndex).
            gate = asyncio.Semaphore(slots)

            async def one(img_bytes, page_idx):
                async with gate:
                    if is_cancelled(taskId):
                        return
                    await _deliver_page(img_bytes, page_idx, config_str, taskId,
                                        callback_url, callback_secret, rolling)

            # return_exceptions: every page settles before `finally` discards the taskId.
            for err in await asyncio.gather(*(one(b, i) for b, i in pages), return_exceptions=True):
                if isinstance(err, BaseException):
                    print(f"[batch] task {taskId} page task failed: {err!r}")
            return
        for img_bytes, page_idx in pages:
            # Stop before starting a new page if the Batch Job was cancelled.
            if is_cancelled(taskId):
                print(f"[batch] task {taskId} cancelled - stopping before page {page_idx}")
                break
            if not await _deliver_page(img_bytes, page_idx, config_str, taskId,
                                       callback_url, callback_secret, rolling):
                break
    finally:
        discard(taskId)


async def _deliver_page(img_bytes, page_idx, config_str, taskId, callback_url, callback_secret, rolling) -> bool:
    """Translate one page and send its webhook; False when the Batch Job was cancelled meanwhile."""
    try:
        # The worker forwards live pipeline-stage events for this page
        # straight to the Backend webhook (UX) — see server.webhook.
        progress_meta = {
            "url": callback_url,
            "secret": callback_secret,
            "taskId": taskId,
            "pageIndex": page_idx,
        }
        # Seed with prior pages' dialogue (empty/absent when disabled, so the
        # call is byte-identical to before).
        prev_block = rolling.render_block()
        extra = {"prev_context": prev_block} if prev_block else {}
        patch_result = await _translate_page(config_str, img_bytes, progress_meta, **extra)
        normalized = normalize_patch_result(patch_result)
        payload = {
            "taskId": taskId,
            "pageIndex": page_idx,
            "imgWidth": normalized["img_width"],
            "imgHeight": normalized["img_height"],
            "patches": normalized["patches"],
            # Text layer (#158): what this page said — the enabler for
            # rolling context (#159) and translation memory (#160).
            "regions": normalized["regions"],
            "error": None,
        }
        # Remember this page's translated dialogue for the next page's context.
        rolling.add_page(r.get("dst", "") for r in normalized["regions"])
    except Exception as exc:
        payload = {
            "taskId": taskId,
            "pageIndex": page_idx,
            "imgWidth": 0,
            "imgHeight": 0,
            "patches": [],
            "error": str(exc),
        }

    # If cancelled while this page was translating, drop its now-unwanted result.
    if is_cancelled(taskId):
        print(f"[batch] task {taskId} cancelled - dropping page {page_idx} result")
        return False
    await send_webhook(callback_url, callback_secret, payload)
    return True
