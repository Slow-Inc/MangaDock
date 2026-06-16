"""Unit tests for server.worker_view — the pure transform from the parent's executor
registry into the Dev-console snapshot's workers.detail (PID / uptime / busy). Import-light
(no PIL / Config), runs in <1s."""

from server.worker_view import worker_view, workers_detail


def test_worker_view_derives_uptime_from_registered_at():
    raw = {"ip": "127.0.0.1", "port": 5004, "pid": 12345, "busy": True, "registered_at": 100.0}
    assert worker_view(raw, now=160.0) == {
        "ip": "127.0.0.1", "port": 5004, "pid": 12345, "busy": True, "uptime_s": 60,
    }


def test_worker_view_uptime_is_none_without_a_registration_time():
    v = worker_view({"ip": "127.0.0.1", "port": 5004, "pid": None, "busy": False, "registered_at": None}, now=10.0)
    assert v["uptime_s"] is None and v["pid"] is None and v["busy"] is False


def test_workers_detail_maps_each_registered_worker():
    raws = [
        {"ip": "127.0.0.1", "port": 5004, "pid": 1, "busy": False, "registered_at": 0.0},
        {"ip": "127.0.0.1", "port": 5005, "pid": 2, "busy": True, "registered_at": 5.0},
    ]
    out = workers_detail(raws, now=10.0)
    assert [w["port"] for w in out] == [5004, 5005]
    assert [w["uptime_s"] for w in out] == [10, 5]
