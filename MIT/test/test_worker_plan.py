"""Tests for the extra-worker planner (pure, no ML imports)."""
from server.worker_plan import (
    MAX_WORKERS,
    parse_worker_count,
    parse_worker_gpus,
    plan_extra_workers,
    worker_settings_from_env,
)


def test_default_is_a_single_worker():
    assert parse_worker_count(None) == 1
    assert parse_worker_count("") == 1
    assert parse_worker_count("nope") == 1
    assert plan_extra_workers(5003, 1) == []


def test_extra_workers_get_consecutive_ports():
    specs = plan_extra_workers(5003, 3)
    assert [s["port"] for s in specs] == [5005, 5006]
    assert [s["device"] for s in specs] == [None, None]


def test_gpus_are_assigned_round_robin_for_extra_workers():
    specs = plan_extra_workers(5003, 3, ["1", "0"])
    assert [s["device"] for s in specs] == ["0", "1"]


def test_count_is_clamped():
    assert parse_worker_count("0") == 1
    assert parse_worker_count("-4") == 1
    assert parse_worker_count(str(MAX_WORKERS + 5)) == MAX_WORKERS


def test_env_settings():
    count, gpus = worker_settings_from_env({"MIT_WORKERS": "2", "MIT_WORKER_GPUS": "1, 0"})
    assert count == 2
    assert gpus == ["1", "0"]
    assert worker_settings_from_env({}) == (1, [])
    assert parse_worker_gpus("") == []
