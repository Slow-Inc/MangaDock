"""#1144 review: the pipelined batch path must report a failed page as a page error.

The batch path is the one whose results the Backend caches for 7 days, and a whole-batch raise would fail the
rest of the chapter. So the worker marks the page on its own result ({"error": ...}) and the batch runner
forwards it — the Backend treats an error page as no result and never caches it.

Drives the real server.batch_runner._run_batch_pipelined with an injected executor + webhook, so the wiring is
pinned rather than the payload shape alone.
"""
import asyncio
from io import BytesIO

from PIL import Image

import server.batch_runner as br


def _jpeg() -> bytes:
    buf = BytesIO()
    Image.new('RGB', (8, 8), 'white').save(buf, format='JPEG')
    return buf.getvalue()


def _ok_page():
    return {'img_width': 8, 'img_height': 8, 'patches': [],
            'regions': [{'src': 'a', 'dst': 'b'}]}


def _failed_page():
    out = {'img_width': 8, 'img_height': 8, 'patches': [], 'regions': []}
    out['error'] = 'translation echoed the source for 4 lines'
    return out


class _Executor:
    def __init__(self, results):
        self.results = results

    async def sent_batch_pipeline(self, images, config):
        return self.results


class _Executors:
    def __init__(self, results):
        self.results = results

    async def find_executor(self):
        return _Executor(self.results)

    async def free_executor(self, executor):
        return None


def _run(monkeypatch, results):
    sent = []

    async def fake_send_webhook(url, secret, payload):
        sent.append(payload)

    monkeypatch.setattr(br, 'send_webhook', fake_send_webhook)
    monkeypatch.setattr(br, 'is_cancelled', lambda task_id: False)
    deps = (Image, lambda config_str: object(), _Executors(results))
    asyncio.run(br._run_batch_pipelined([0, 1], [_jpeg(), _jpeg()], '{}', 'task-1',
                                        'http://cb', 'secret', deps=deps))
    return sent


def test_a_failed_page_travels_as_a_page_error_and_the_rest_still_lands(monkeypatch):
    sent = _run(monkeypatch, [_ok_page(), _failed_page()])
    assert len(sent) == 2
    assert sent[0]['error'] is None and sent[0]['regions'] == [{'src': 'a', 'dst': 'b'}]
    # the failed page carries its reason, so the Backend records a page error instead of caching an empty page
    assert sent[1]['error'] == 'translation echoed the source for 4 lines'
    assert sent[1]['patches'] == []


def test_a_healthy_batch_sends_no_errors(monkeypatch):
    sent = _run(monkeypatch, [_ok_page(), _ok_page()])
    assert [p['error'] for p in sent] == [None, None]
