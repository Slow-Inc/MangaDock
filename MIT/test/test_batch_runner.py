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
def _clean_registry(monkeypatch):
    # #1119: a shell with MIT_WORKERS>1 exported must not move the sequential-loop tests onto batch slots.
    monkeypatch.delenv("MIT_WORKERS", raising=False)
    monkeypatch.delenv("MIT_BATCH_CONCURRENCY", raising=False)
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


# ---- #905: the opt-in whole-batch pipeline path ----


class _FakeImage:
    @staticmethod
    def open(_b):
        return _FakeImage()

    def convert(self, _mode):
        return self


class _FakeExecutor:
    def __init__(self, results=None, error=None):
        self.results = results
        self.error = error
        self.calls = 0

    async def sent_batch_pipeline(self, images, config):
        self.calls += 1
        assert len(images) >= 1
        if self.error:
            raise RuntimeError(self.error)
        return self.results


class _FakeExecutors:
    def __init__(self, executor):
        self.executor = executor
        self.freed = 0

    async def find_executor(self):
        return self.executor

    async def free_executor(self, _executor):
        self.freed += 1


def _pipeline_deps(executor):
    executors = _FakeExecutors(executor)
    return (lambda: (_FakeImage, lambda _s: object(), executors)), executors


def _page_result():
    return {"img_width": 10, "img_height": 20, "patches": [], "regions": [{"src": "a", "dst": "b"}]}


def _run_batch_pipelined(monkeypatch, executor, pages=(0, 1, 2)):
    sent = []

    async def fake_send(url, secret, payload):
        sent.append((payload["pageIndex"], payload["error"], len(payload.get("regions") or [])))

    monkeypatch.setattr(batch_runner, "send_webhook", fake_send)
    deps_fn, executors = _pipeline_deps(executor)
    asyncio.run(batch_runner._run_batch_pipelined(list(pages), [b'img'] * len(pages), '{}', TASK,
                                                  "http://backend/cb", "", deps=deps_fn()))
    return sent, executors


def test_pipeline_path_delivers_one_webhook_per_page_in_order(monkeypatch):
    executor = _FakeExecutor(results=[_page_result() for _ in range(3)])
    sent, executors = _run_batch_pipelined(monkeypatch, executor)
    assert executor.calls == 1, 'the whole batch must go to ONE worker'
    assert executors.freed == 1, 'the worker must be released'
    assert sent == [(0, None, 1), (1, None, 1), (2, None, 1)]


def test_pipeline_path_reports_a_worker_failure_per_page(monkeypatch):
    executor = _FakeExecutor(error='worker died')
    sent, _ = _run_batch_pipelined(monkeypatch, executor)
    assert [p for p, _e, _r in sent] == [0, 1, 2]
    assert all(e == 'worker died' for _p, e, _r in sent)


def test_pipeline_path_drops_deliveries_after_a_cancel(monkeypatch):
    executor = _FakeExecutor(results=[_page_result() for _ in range(3)])
    sent = []

    async def fake_send(url, secret, payload):
        sent.append(payload["pageIndex"])
        cancellation.mark_cancelled(TASK)  # cancel lands right after page 0 is delivered

    monkeypatch.setattr(batch_runner, "send_webhook", fake_send)
    deps_fn, _ = _pipeline_deps(executor)
    asyncio.run(batch_runner._run_batch_pipelined([0, 1, 2], [b'img'] * 3, '{}', TASK,
                                                  "http://backend/cb", "", deps=deps_fn()))
    assert sent == [0]


def test_the_pipeline_path_is_opt_in(monkeypatch):
    monkeypatch.delenv('MIT_BATCH_PIPELINE', raising=False)
    assert batch_runner._pipeline_enabled() is False
    monkeypatch.setenv('MIT_BATCH_PIPELINE', '1')
    assert batch_runner._pipeline_enabled() is True


# --- #1119: batch slots — independent pages run concurrently, one per worker ------------------


def _concurrency_probe(monkeypatch, sent, delay=0.02):
    state = {"now": 0, "max": 0}

    async def translate(config_str, img_bytes, progress_meta=None, **kw):
        state["now"] += 1
        state["max"] = max(state["max"], state["now"])
        await asyncio.sleep(delay)
        state["now"] -= 1
        return {"img_width": 100, "img_height": 200, "patches": []}

    _stub_pipeline(monkeypatch, sent, translate=translate)
    return state


def test_slot_count_comes_from_workers_or_override():
    assert batch_runner.batch_slots({}) == 1
    assert batch_runner.batch_slots({"MIT_WORKERS": "4"}) == 4
    assert batch_runner.batch_slots({"MIT_WORKERS": "4", "MIT_BATCH_CONCURRENCY": "2"}) == 2
    assert batch_runner.batch_slots({"MIT_BATCH_CONCURRENCY": "0"}) == 1


def test_independent_pages_run_one_per_slot(monkeypatch):
    sent = []
    monkeypatch.setenv("MIT_WORKERS", "2")
    state = _concurrency_probe(monkeypatch, sent)
    _run_batch(pages=(0, 1, 2, 3))
    assert state["max"] == 2
    assert sorted(sent) == [0, 1, 2, 3]


def test_single_worker_keeps_pages_sequential(monkeypatch):
    sent = []
    monkeypatch.delenv("MIT_WORKERS", raising=False)
    state = _concurrency_probe(monkeypatch, sent)
    _run_batch(pages=(0, 1, 2))
    assert state["max"] == 1 and sent == [0, 1, 2]


def test_rolling_context_keeps_pages_sequential_even_with_workers(monkeypatch):
    sent = []
    monkeypatch.setenv("MIT_WORKERS", "4")
    monkeypatch.setenv("MIT_CONTEXT_PAGES", "2")
    state = _concurrency_probe(monkeypatch, sent)
    _run_batch(pages=(0, 1, 2))
    assert state["max"] == 1 and sent == [0, 1, 2]


def test_cancel_stops_pages_that_have_not_started(monkeypatch):
    sent = []
    monkeypatch.setenv("MIT_WORKERS", "2")

    async def translate(config_str, img_bytes, progress_meta=None, **kw):
        await asyncio.sleep(0.02)
        cancellation.mark_cancelled(TASK)  # cancel lands while the first two pages run
        return {"img_width": 100, "img_height": 200, "patches": []}

    _stub_pipeline(monkeypatch, sent, translate=translate)
    _run_batch(pages=(0, 1, 2, 3))
    assert sent == []  # in-flight results are dropped, pages 2-3 never start


def test_slot_count_multiplies_worker_slots():
    # #1123: 2 workers x 3 slots each -> 6 pages in flight (worker slots need preload).
    env = {"MIT_WORKERS": "2", "MIT_WORKER_SLOTS": "3", "MIT_PRELOAD": "1"}
    assert batch_runner.batch_slots(env) == 6
    assert batch_runner.batch_slots({"MIT_WORKERS": "2", "MIT_WORKER_SLOTS": "3"}) == 2   # no preload -> 1 slot
