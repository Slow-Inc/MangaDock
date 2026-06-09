"""Worker liveness probing for the web server's /ready endpoint.

Import-light (httpx only — same pattern as server/webhook.py) so it
unit-tests in <1s without the ML stack. A worker that registered and later
died (e.g. crashed while loading the translation model) stays registered
forever; /ready must probe instead of trusting registration (2026-06-06
incident: dead worker → every batch page failed fast with connection-refused
while /ready kept answering 200).
"""
import os

import httpx


def _probe_timeout_s() -> float:
    return float(os.environ.get("MIT_READY_PROBE_TIMEOUT_S", "2"))


async def worker_reachable(ip: str, port: int) -> bool:
    """True if the worker's /health endpoint answers 200."""
    try:
        async with httpx.AsyncClient(timeout=_probe_timeout_s()) as client:
            resp = await client.get(f"http://{ip}:{port}/health")
            return resp.status_code == 200
    except Exception:
        return False


async def count_alive(workers) -> int:
    """Number of workers considered alive.

    A busy worker is mid-inference, which can block its event loop and fail
    the probe — count it alive without probing it.
    """
    alive = 0
    for worker in workers:
        if worker.busy or await worker_reachable(worker.ip, worker.port):
            alive += 1
    return alive
