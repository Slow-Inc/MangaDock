"""Background batch loop for webhook-mode batch translation.

Extracted from ``server/main.py`` so the cancellation semantics around the loop
are unit-testable without importing the ML stack — same rationale as
``server/webhook.py`` (Issue #100). The only heavy work (config parse + the
translation pipeline) sits behind ``_translate_page``, whose imports are
deferred to call time.
"""
import base64

from server.cancellation import is_cancelled, discard
from server.webhook import send_webhook


async def _translate_page(config_str: str, img_bytes: bytes, progress_meta: dict | None = None) -> dict:
    """Run a single page through the translation pipeline.

    Heavy imports are deferred so importing this module stays fast for tests.
    The config is re-parsed per page to avoid any state mutation across pages.
    """
    from manga_translator import Config
    from server.request_extraction import get_patch_ctx

    # Dummy request mock for internal pipeline compatibility
    class DummyRequest:
        async def is_disconnected(self):
            return False

    page_conf = Config.parse_raw(config_str)
    return await get_patch_ctx(DummyRequest(), page_conf, img_bytes, progress_meta=progress_meta)


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
    try:
        for img_bytes, page_idx in zip(images_data, index_list):
            # Stop before starting a new page if the Batch Job was cancelled.
            if is_cancelled(taskId):
                print(f"[batch] task {taskId} cancelled - stopping before page {page_idx}")
                break
            try:
                # The worker forwards live pipeline-stage events for this page
                # straight to the Backend webhook (UX) — see server.webhook.
                progress_meta = {
                    "url": callback_url,
                    "secret": callback_secret,
                    "taskId": taskId,
                    "pageIndex": page_idx,
                }
                patch_result = await _translate_page(config_str, img_bytes, progress_meta)
                patches_out = []
                for patch in patch_result.get("patches", []):
                    png_bytes = patch.get("img_png", b"")
                    patches_out.append({
                        "x": patch.get("x", 0),
                        "y": patch.get("y", 0),
                        "w": patch.get("w", 0),
                        "h": patch.get("h", 0),
                        "img_b64": base64.b64encode(png_bytes).decode("utf-8"),
                    })
                payload = {
                    "taskId": taskId,
                    "pageIndex": page_idx,
                    "imgWidth": patch_result.get("img_width", 0),
                    "imgHeight": patch_result.get("img_height", 0),
                    "patches": patches_out,
                    "error": None,
                }
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
                break
            await send_webhook(callback_url, callback_secret, payload)
    finally:
        discard(taskId)
