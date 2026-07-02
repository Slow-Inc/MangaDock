"""Dev-console status snapshot for MIT (PRD #279, slice 1d/1f, ADR 016).

Folds the already-collected parts — host/GPU metrics (`server.metrics`), the
translator-gateway probe (`server.diagnostics`), queue depth, worker liveness and
the active translator — into one JSON snapshot, and derives the per-service
SSE messages the Dashboard's reducer (`Dashboard/lib/snapshot.ts`) consumes.

Pure / stdlib-only (gateway is duck-typed, not imported) so it unit-tests in <1s
without httpx or the ML stack, same pattern as `server.metrics`.
"""

# Gateway probe states that mean the translator is unusable even when workers are up.
_GATEWAY_BAD = {"timeout", "unreachable", "auth", "model_missing"}


def _gateway_dict(gateway) -> dict | None:
    if gateway is None:
        return None
    return {
        "status": gateway.status,
        "latency_ms": gateway.latency_ms,
        "control_ms": getattr(gateway, "control_ms", None),
        "detail": gateway.detail,
    }


def _derive_status(workers: dict, gateway) -> str:
    """up | degraded | down. No live worker → down (can't translate at all); a
    bad gateway with workers up → degraded (pipeline runs but translate stalls,
    the 2026-06-14 signature); otherwise up."""
    if not workers.get("alive"):
        return "down"
    if gateway is not None and gateway.status in _GATEWAY_BAD:
        return "degraded"
    return "up"


def build_snapshot(*, ts, host, gpus, gateway, queue_size, workers, translator,
                   queue_jobs=None, telemetry=None) -> dict:
    """Compose the full MIT status snapshot served by `GET /status`.

    `queue_jobs` (parent-side: the TaskQueue contents) and `telemetry` (worker-reported
    stage timings / last-run summary / per-model VRAM, via server.telemetry_store) are
    optional — absent → omitted, so the snapshot stays lean and the Dashboard reducer
    (which ignores unknown keys) is unaffected when there's no data."""
    snap = {
        "service": "mit",
        "ts": ts,
        "status": _derive_status(workers, gateway),
        "host": host,
        "gpus": gpus,
        "gateway": _gateway_dict(gateway),
        "queue": {"size": queue_size, "jobs": queue_jobs or []},
        "workers": workers,
        "translator": translator,
    }
    if telemetry:
        # Only surface the worker-reported sections that actually have data.
        for key in ("stages", "vram"):
            if telemetry.get(key):
                snap[key] = telemetry[key]
    return snap


def to_messages(snapshot: dict) -> list[dict]:
    """Derive the per-service SSE frames from a snapshot.

    The `metric` frame carries the WHOLE snapshot (host+gpu, queue, workers,
    translator, overall status) — a superset of `Dashboard/lib/snapshot.ts`'s
    `MetricMessage` (which reads only `host`/`gpus`), so the client gets every
    field from one frame while the reducer still folds it. When the gateway was
    probed, a `status` (subsystem) frame follows for the multi-service board."""
    messages: list[dict] = [{"type": "metric", **snapshot}]
    gateway = snapshot.get("gateway")
    if gateway is not None:
        messages.append({
            "type": "status",
            "service": "mit",
            "subsystem": "gateway",
            "status": gateway["status"],
            "detail": gateway["detail"],
        })
    return messages
