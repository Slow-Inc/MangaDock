"""Unit tests for /ready worker liveness probing (2026-06-06 incident).

Pure-logic tests: httpx is faked, no network and no ML imports, so the whole
module imports in <1s (same pattern as test_send_webhook.py). Async entry
points are driven with asyncio.run() so no pytest-asyncio dependency is needed.
"""
import asyncio
from types import SimpleNamespace

from server import readiness


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code


class FakeClient:
    """Async-context HTTP client stub. Replays a scripted list of outcomes and
    records every GET. An outcome is either an int status code or an Exception
    instance (raised, to simulate a dead worker / connection refused)."""

    def __init__(self, outcomes):
        self._outcomes = list(outcomes)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url):
        self.calls.append(url)
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return FakeResponse(outcome)


def _install(monkeypatch, outcomes):
    client = FakeClient(outcomes)
    monkeypatch.setattr(readiness.httpx, "AsyncClient", lambda *a, **k: client)
    return client


def _worker(busy=False, ip="127.0.0.1", port=5004):
    return SimpleNamespace(busy=busy, ip=ip, port=port)


def test_dead_worker_is_not_counted_alive(monkeypatch):
    """A worker that registered and later died (connection refused) must not
    count as alive — /ready trusting registration alone is the bug that let a
    dead worker report ready=True while every translate call failed."""
    _install(monkeypatch, [ConnectionError("connection refused")])

    alive = asyncio.run(readiness.count_alive([_worker()]))

    assert alive == 0


def test_busy_worker_counts_alive_without_probe(monkeypatch):
    """A busy worker is mid-inference, which can block its event loop and fail
    the probe — it must count as alive with no HTTP call at all."""
    client = _install(monkeypatch, [])  # any HTTP call would exhaust outcomes and raise

    alive = asyncio.run(readiness.count_alive([_worker(busy=True)]))

    assert alive == 1
    assert client.calls == []


def test_healthy_worker_counts_alive(monkeypatch):
    client = _install(monkeypatch, [200])

    alive = asyncio.run(readiness.count_alive([_worker(port=5004)]))

    assert alive == 1
    assert client.calls == ["http://127.0.0.1:5004/health"]


def test_worker_answering_non_200_is_not_counted_alive(monkeypatch):
    _install(monkeypatch, [500])

    alive = asyncio.run(readiness.count_alive([_worker()]))

    assert alive == 0
