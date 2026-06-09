"""Live translation progress events (UX).

MIT posts per-stage progress webhooks so the Reader can show what the
20-60s per-page wait is actually doing. Fire-and-forget: one attempt,
short timeout, never raises — a lost progress event costs nothing.
Pure-logic tests: httpx faked, no ML imports (same pattern as
test_send_webhook.py).
"""
import asyncio

from server import webhook


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code


class FakeClient:
    def __init__(self, outcomes):
        self._outcomes = list(outcomes)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, content=None, headers=None, timeout=None):
        self.calls.append({"url": url, "headers": headers, "content": content})
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return FakeResponse(outcome)


def _install(monkeypatch, outcomes):
    client = FakeClient(outcomes)
    monkeypatch.setattr(webhook.httpx, "AsyncClient", lambda *a, **k: client)
    return client


def test_send_progress_posts_signed_payload_once(monkeypatch):
    client = _install(monkeypatch, [200])

    asyncio.run(webhook.send_progress(
        "http://backend/webhooks/mit/callback", "s3cret",
        {"taskId": "t", "pageIndex": 1, "stage": "translating"},
    ))

    assert len(client.calls) == 1
    assert "x-mit-signature" in client.calls[0]["headers"]
    assert b'"stage":"translating"' in client.calls[0]["content"]


def test_send_progress_never_retries_and_never_raises(monkeypatch):
    client = _install(monkeypatch, [ConnectionError("backend down")])

    asyncio.run(webhook.send_progress("http://backend/cb", "s", {"stage": "ocr"}))

    assert len(client.calls) == 1  # no retry chain for informational events


def test_progress_hook_forwards_pipeline_stages_only(monkeypatch):
    sent = []

    async def fake_send(url, secret, payload):
        sent.append(payload)

    monkeypatch.setattr(webhook, "send_progress", fake_send)
    hook = webhook.make_progress_hook(
        {"url": "http://b/cb", "secret": "s", "taskId": "t1", "pageIndex": 4},
    )

    async def drive():
        await hook("detection", False)
        await hook("translating", False)
        await hook("after-translating", False)   # bookkeeping — not user-facing
        await hook("skip-no-regions", True)      # bookkeeping — not user-facing

    asyncio.run(drive())

    assert sent == [
        {"taskId": "t1", "pageIndex": 4, "stage": "detection"},
        {"taskId": "t1", "pageIndex": 4, "stage": "translating"},
    ]
