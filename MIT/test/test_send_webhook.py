"""Unit tests for MIT -> Backend webhook delivery (Issue #100).

Pure-logic tests: httpx is faked, no network and no ML imports, so the whole
module imports in <1s. Async entry points are driven with asyncio.run() so no
pytest-asyncio dependency is needed.
"""
import asyncio
import json

from server import webhook


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code


class FakeClient:
    """Async-context HTTP client stub. Replays a scripted list of outcomes and
    records every POST. An outcome is either an int status code or an Exception
    instance (raised, to simulate a connection error / timeout)."""

    def __init__(self, outcomes):
        self._outcomes = list(outcomes)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, content=None, headers=None, timeout=None):
        self.calls.append({"url": url, "headers": headers, "timeout": timeout, "content": content})
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return FakeResponse(outcome)


def _install(monkeypatch, outcomes, *, no_sleep=True):
    client = FakeClient(outcomes)
    monkeypatch.setattr(webhook.httpx, "AsyncClient", lambda *a, **k: client)
    if no_sleep and hasattr(webhook, "asyncio"):
        async def _noop(_):
            return None
        monkeypatch.setattr(webhook.asyncio, "sleep", _noop)
    return client


def _install_recording_sleep(monkeypatch, outcomes):
    """Like _install but records the backoff durations instead of skipping them."""
    client = FakeClient(outcomes)
    monkeypatch.setattr(webhook.httpx, "AsyncClient", lambda *a, **k: client)
    sleeps = []

    async def _rec(d):
        sleeps.append(d)

    monkeypatch.setattr(webhook.asyncio, "sleep", _rec)
    return client, sleeps


def _dead_letter_record(capsys):
    """Returns the parsed dead-letter JSON from captured stdout, or None if none
    was emitted."""
    out = capsys.readouterr().out
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            continue
        if isinstance(obj, dict) and obj.get("event") == "webhook_dead_letter":
            return obj
    return None


def _run(coro):
    return asyncio.run(coro)


PAYLOAD = {"taskId": "ch:ANY:THA", "pageIndex": 0, "imgWidth": 100, "imgHeight": 100, "patches": []}


def test_delivers_once_on_2xx(monkeypatch):
    """Happy path: a 200 response delivers in exactly one POST, no retry."""
    client = _install(monkeypatch, [200])
    _run(webhook.send_webhook("http://localhost:4001/webhooks/mit/callback", "", PAYLOAD))
    assert len(client.calls) == 1


def test_retries_5xx_then_succeeds(monkeypatch):
    """A transient 5xx is retried; once a 2xx arrives, delivery stops."""
    client = _install(monkeypatch, [500, 200])
    _run(webhook.send_webhook("http://x/cb", "", PAYLOAD))
    assert len(client.calls) == 2


def test_retries_connection_error_then_succeeds(monkeypatch):
    """A connection error / timeout is transient and is retried."""
    client = _install(monkeypatch, [OSError("connection refused"), 200])
    _run(webhook.send_webhook("http://x/cb", "", PAYLOAD))
    assert len(client.calls) == 2


def test_429_is_retried(monkeypatch):
    """429 (rate limit) is transient and retried."""
    client = _install(monkeypatch, [429, 200])
    _run(webhook.send_webhook("http://x/cb", "", PAYLOAD))
    assert len(client.calls) == 2


def test_does_not_retry_4xx_and_dead_letters(monkeypatch, capsys):
    """A non-retryable 4xx (e.g. 413 payload too large) is given up on
    immediately — one POST, no retry — and dead-lettered."""
    client = _install(monkeypatch, [413, 200])  # 200 must never be reached
    _run(webhook.send_webhook("http://x/cb", "", PAYLOAD))
    assert len(client.calls) == 1
    dl = _dead_letter_record(capsys)
    assert dl is not None and dl["pageIndex"] == 0 and "413" in dl["reason"]


def test_dead_letters_after_exhausting_retries(monkeypatch, capsys):
    """Persistent 5xx exhausts the budget (default 3 retries = 4 attempts) then
    dead-letters."""
    client = _install(monkeypatch, [500, 500, 500, 500])
    _run(webhook.send_webhook("http://x/cb", "", PAYLOAD))
    assert len(client.calls) == 4
    dl = _dead_letter_record(capsys)
    assert dl is not None and dl["taskId"] == "ch:ANY:THA"


def test_no_dead_letter_on_success(monkeypatch, capsys):
    """A recovered delivery must not emit a dead-letter."""
    _install(monkeypatch, [500, 200])
    _run(webhook.send_webhook("http://x/cb", "", PAYLOAD))
    assert _dead_letter_record(capsys) is None


def test_env_controls_retry_count(monkeypatch, capsys):
    """MIT_WEBHOOK_MAX_RETRIES bounds the attempts."""
    monkeypatch.setenv("MIT_WEBHOOK_MAX_RETRIES", "1")
    client = _install(monkeypatch, [500, 500])  # 1 retry -> 2 attempts total
    _run(webhook.send_webhook("http://x/cb", "", PAYLOAD))
    assert len(client.calls) == 2


def test_exponential_backoff_schedule(monkeypatch):
    """Backoff doubles each retry from the configured base (default 500ms)."""
    client, sleeps = _install_recording_sleep(monkeypatch, [500, 500, 500, 500])
    _run(webhook.send_webhook("http://x/cb", "", PAYLOAD))
    assert sleeps == [0.5, 1.0, 2.0]  # 3 sleeps between 4 attempts; none after the last


def test_signs_when_secret_present(monkeypatch):
    """A configured secret produces an x-mit-signature header."""
    client = _install(monkeypatch, [200])
    _run(webhook.send_webhook("http://x/cb", "topsecret", PAYLOAD))
    assert "x-mit-signature" in client.calls[0]["headers"]
