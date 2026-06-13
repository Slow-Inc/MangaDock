"""Behavior tests for the webhook-mode batch loop (Issue #128).

taskId is deterministic (`chapterId:src:tgt`), so a cancel that arrives *after*
a run already finished used to leave the taskId marked cancelled forever — the
next run of the same chapter was then dropped on its first page and sent no
webhooks at all ("MIT doesn't run" on re-translate).

Pure logic — `_translate_page` and `send_webhook` are stubbed, no ML imports.
"""
import asyncio

import pytest

from server import batch_runner, cancellation

TASK = "ch:ANY:THA"


@pytest.fixture(autouse=True)
def _clean_registry():
    cancellation._cancelled.clear()
    yield
    cancellation._cancelled.clear()


def _stub_pipeline(monkeypatch, sent, translate=None):
    async def default_translate(config_str, img_bytes, progress_meta=None):
        return {"img_width": 100, "img_height": 200, "patches": []}

    async def fake_send(url, secret, payload):
        sent.append(payload["pageIndex"])

    monkeypatch.setattr(batch_runner, "_translate_page", translate or default_translate)
    monkeypatch.setattr(batch_runner, "send_webhook", fake_send)


def _run_batch(pages=(0, 1)):
    return asyncio.run(
        batch_runner.run_batch_with_callbacks(
            list(pages), [b"img"] * len(pages), "{}", TASK, "http://backend/cb", ""
        )
    )


def test_stale_cancel_flag_does_not_poison_a_new_run(monkeypatch):
    """A cancel that landed after the previous run finished must not drop the next run."""
    sent = []
    _stub_pipeline(monkeypatch, sent)

    cancellation.mark_cancelled(TASK)  # stale leftover from the previous run
    _run_batch(pages=(0, 1))

    assert sent == [0, 1]


def test_cancel_during_a_page_still_drops_its_result(monkeypatch):
    """#101 semantics survive the fix: a cancel arriving while a page translates
    drops that page's result and stops the run."""
    sent = []

    async def translate_then_cancel(config_str, img_bytes, progress_meta=None):
        cancellation.mark_cancelled(TASK)  # user cancels mid-inference
        return {"img_width": 100, "img_height": 200, "patches": []}

    _stub_pipeline(monkeypatch, sent, translate=translate_then_cancel)

    _run_batch(pages=(0, 1))

    assert sent == []


def test_cancel_between_pages_stops_before_next_page(monkeypatch):
    """#101 semantics survive the fix: a cancel arriving after page 0 was
    delivered stops the run before page 1 starts."""
    sent = []

    async def fake_send(url, secret, payload):
        sent.append(payload["pageIndex"])
        cancellation.mark_cancelled(TASK)  # cancel lands right after delivery

    async def fake_translate(config_str, img_bytes, progress_meta=None):
        return {"img_width": 100, "img_height": 200, "patches": []}

    monkeypatch.setattr(batch_runner, "_translate_page", fake_translate)
    monkeypatch.setattr(batch_runner, "send_webhook", fake_send)

    _run_batch(pages=(0, 1))

    assert sent == [0]


def test_each_page_gets_progress_meta_for_live_stage_events(monkeypatch):
    """The worker forwards live pipeline-stage events per page (UX) — the batch
    loop must hand it the webhook target plus the page's identity."""
    sent = []
    metas = []

    async def capture_translate(config_str, img_bytes, progress_meta=None):
        metas.append(progress_meta)
        return {"img_width": 100, "img_height": 200, "patches": []}

    _stub_pipeline(monkeypatch, sent, translate=capture_translate)

    _run_batch(pages=(0, 1))

    assert metas == [
        {"url": "http://backend/cb", "secret": "", "taskId": TASK, "pageIndex": 0},
        {"url": "http://backend/cb", "secret": "", "taskId": TASK, "pageIndex": 1},
    ]


def test_taskid_is_discarded_after_the_run(monkeypatch):
    """The registry never leaks: finished runs leave no flag behind."""
    sent = []
    _stub_pipeline(monkeypatch, sent)

    _run_batch(pages=(0,))

    assert cancellation.is_cancelled(TASK) is False
    assert TASK not in cancellation._cancelled


def test_webhook_payload_carries_the_page_text_layer(monkeypatch):
    """#158: the batch loop sees what each finished page said — regions ride
    the per-page webhook payload."""
    payloads = []

    async def translate(config_str, img_bytes, progress_meta=None):
        return {
            "img_width": 100,
            "img_height": 200,
            "patches": [],
            "regions": [{"src": "Huh?", "dst": "หา?"}],
        }

    async def fake_send(url, secret, payload):
        payloads.append(payload)

    monkeypatch.setattr(batch_runner, "_translate_page", translate)
    monkeypatch.setattr(batch_runner, "send_webhook", fake_send)
    _run_batch(pages=(0,))

    assert payloads[0]["regions"] == [{"src": "Huh?", "dst": "หา?"}]
    assert payloads[0]["patches"] == []


# ---- #159 rolling cross-page context within a Batch Job --------------------------

def test_rolling_context_seeds_the_next_page_with_prior_page_translations(monkeypatch):
    """With MIT_CONTEXT_PAGES > 0, page N+1's pipeline call carries page N's translated
    dialogue as prev_context (the Batch Job's Translation Session)."""
    monkeypatch.setenv("MIT_CONTEXT_PAGES", "3")
    seen_prev = []
    dst_by_page = iter([
        [{"src": "ガキ", "dst": "This brat"}],
        [{"src": "フッ", "dst": "Heh"}],
    ])

    async def translate(config_str, img_bytes, progress_meta=None, prev_context=None):
        seen_prev.append(prev_context)
        return {"img_width": 1, "img_height": 1, "patches": [], "regions": next(dst_by_page)}

    async def fake_send(url, secret, payload):
        pass

    monkeypatch.setattr(batch_runner, "_translate_page", translate)
    monkeypatch.setattr(batch_runner, "send_webhook", fake_send)
    _run_batch(pages=(0, 1))

    assert not seen_prev[0]                              # page 0: nothing prior
    assert "This brat" in (seen_prev[1] or "")          # page 1: carries page 0's translation
    assert "<|1|>" in (seen_prev[1] or "")              # numbered-block format


def test_rolling_context_off_by_default_keeps_the_call_byte_identical(monkeypatch):
    """MIT_CONTEXT_PAGES unset/0 → no prev_context is ever passed (today's behavior)."""
    monkeypatch.delenv("MIT_CONTEXT_PAGES", raising=False)
    seen_kwargs = []

    async def translate(config_str, img_bytes, progress_meta=None, **kwargs):
        seen_kwargs.append(kwargs)
        return {"img_width": 1, "img_height": 1, "patches": [], "regions": [{"src": "a", "dst": "b"}]}

    async def fake_send(url, secret, payload):
        pass

    monkeypatch.setattr(batch_runner, "_translate_page", translate)
    monkeypatch.setattr(batch_runner, "send_webhook", fake_send)
    _run_batch(pages=(0, 1))

    assert seen_kwargs == [{}, {}]                       # prev_context never injected
