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


# --- #1119: GPU-aware dispatch (Strata replicas.Router: lowest load wins) -----------------

from server.worker_plan import pick_free_worker


def test_pick_free_worker_returns_none_when_every_worker_is_busy():
    assert pick_free_worker([(True, '1'), (True, '0')]) is None


def test_pick_free_worker_keeps_registration_order_on_one_device():
    # Same device everywhere (or unknown) -> first free worker, exactly as before #1119.
    assert pick_free_worker([(True, None), (False, None), (False, None)]) == 1
    assert pick_free_worker([(False, '1'), (False, '1')]) == 0


def test_pick_free_worker_prefers_the_gpu_with_fewest_busy_workers():
    # Workers 0-2 on GPU1, worker 3 on GPU0; worker 0 is busy -> GPU0 is idle, so worker 3.
    workers = [(True, '1'), (False, '1'), (False, '1'), (False, '0')]
    assert pick_free_worker(workers) == 3


def test_pick_free_worker_ties_go_to_registration_order():
    # Both GPUs have one busy worker -> first free worker in list order.
    workers = [(True, '1'), (False, '1'), (True, '0'), (False, '0')]
    assert pick_free_worker(workers) == 1
