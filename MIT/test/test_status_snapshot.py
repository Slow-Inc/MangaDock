"""Unit tests for the Dev-console status snapshot builder (PRD #279, ADR 016).

Pure-logic tests: stdlib only, no ML / no httpx / no network, so the module
imports in <1s (same pattern as test_metrics.py / test_translate_error.py). The
builder folds the already-collected parts (host/gpu metrics, gateway probe,
queue, workers, translator) into the wire shape the Dashboard's snapshot reducer
(`Dashboard/lib/snapshot.ts`) consumes.
"""
from server.status_snapshot import build_snapshot, to_messages


class FakeGateway:
    """Duck-types server.diagnostics.GatewayStatus without importing httpx."""

    def __init__(self, status, latency_ms, detail, control_ms=None):
        self.status = status
        self.latency_ms = latency_ms
        self.detail = detail
        self.control_ms = control_ms


def _snap(**over):
    base = dict(
        ts=123.0,
        host={"cpu_pct": 42, "ram_used_mb": 9800, "ram_total_mb": 32000, "disk_used_pct": 34},
        gpus=[{"util_pct": 65, "temp_c": 68, "power_w": 120, "fan_pct": 40, "vram_used_mb": 5900, "vram_total_mb": 12282}],
        gateway=FakeGateway("ok", 120, "gateway and model healthy", control_ms=30),
        queue_size=2,
        workers={"alive": 1, "total": 1, "free": 0},
        translator="custom_openai",
    )
    base.update(over)
    return build_snapshot(**base)


def test_build_snapshot_composes_the_wire_shape():
    snap = _snap()
    assert snap["service"] == "mit"
    assert snap["ts"] == 123.0
    assert snap["host"]["cpu_pct"] == 42
    assert snap["gpus"][0]["util_pct"] == 65
    assert snap["gateway"] == {"status": "ok", "latency_ms": 120, "control_ms": 30, "detail": "gateway and model healthy"}
    assert snap["queue"] == {"size": 2, "jobs": []}
    assert snap["workers"] == {"alive": 1, "total": 1, "free": 0}
    assert snap["translator"] == "custom_openai"
    assert snap["status"] == "up"
    # Worker-reported telemetry sections are absent (lean) when none was supplied.
    assert "stages" not in snap and "vram" not in snap


def test_queue_jobs_are_carried_when_present():
    jobs = [{"id": "t1", "task_type": "translate_patches", "waiting_ms": 1200}]
    snap = _snap(queue_jobs=jobs)
    assert snap["queue"] == {"size": 2, "jobs": jobs}


def test_telemetry_sections_surface_only_when_they_have_data():
    telem = {
        "stages": [{"id": "translate", "label": "Translate", "live_ms": 150}],
        "vram": {"allocated_mb": 5000, "reserved_mb": 6000,
                 "models": [{"model": "ocr", "footprint_mb": 2400, "freed_mb": 2390, "leaked": False}]},
    }
    snap = _snap(telemetry=telem)
    assert snap["stages"] == telem["stages"]
    assert snap["vram"] == telem["vram"]


def test_empty_telemetry_is_omitted():
    snap = _snap(telemetry={"stages": [], "vram": None})
    assert "stages" not in snap and "vram" not in snap


def test_no_live_worker_is_down():
    snap = _snap(workers={"alive": 0, "total": 1, "free": 0})
    assert snap["status"] == "down"


def test_bad_gateway_with_workers_up_is_degraded():
    # The 2026-06-14 signature: worker alive, pipeline runs, but translate stalls.
    snap = _snap(gateway=FakeGateway("timeout", None, "model not responding"))
    assert snap["status"] == "degraded"
    assert snap["gateway"]["status"] == "timeout"
    assert snap["gateway"]["latency_ms"] is None


def test_unprobed_gateway_is_null_and_does_not_force_degraded():
    snap = _snap(gateway=None)
    assert snap["gateway"] is None
    assert snap["status"] == "up"


def test_to_messages_metric_frame_carries_the_full_snapshot():
    snap = _snap()
    msgs = to_messages(snap)
    # The metric frame is the whole snapshot (host+gpu AND queue/workers/translator/
    # overall status) tagged type:"metric" — a superset of snapshot.ts's MetricMessage,
    # so the client gets everything from one frame.
    assert msgs[0] == {"type": "metric", **snap}
    assert msgs[0]["queue"] == {"size": 2, "jobs": []}
    assert msgs[0]["workers"]["alive"] == 1
    assert msgs[0]["status"] == "up"
    # Plus a gateway subsystem frame for the multi-service reducer.
    assert msgs[1] == {"type": "status", "service": "mit", "subsystem": "gateway",
                       "status": "ok", "detail": "gateway and model healthy"}


def test_to_messages_omits_gateway_frame_when_unprobed():
    msgs = to_messages(_snap(gateway=None))
    assert len(msgs) == 1
    assert msgs[0]["type"] == "metric"
