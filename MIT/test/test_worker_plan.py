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


def test_pick_free_worker_counts_load_per_card_not_per_device_label():
    # Two hosts both report CUDA_VISIBLE_DEVICES=0: different cards, so host B's idle card wins.
    workers = [(True, ('10.0.0.1', '0')), (False, ('10.0.0.1', '0')), (False, ('10.0.0.2', '0'))]
    assert pick_free_worker(workers) == 2


def test_card_key_treats_an_unset_device_as_cuda_default_card_0():
    # A worker started without CUDA_VISIBLE_DEVICES runs on CUDA device 0, so it shares card '0's load.
    from server.worker_plan import card_key
    assert card_key('127.0.0.1', None) == card_key('127.0.0.1', '') == card_key('127.0.0.1', '0') == ('127.0.0.1', '0')
    assert card_key('127.0.0.1', '1') == ('127.0.0.1', '1')


# --- #1119 / #1118 review: a worker that dies after spawning leaves dispatch (Strata replica heal) ---

from server.worker_plan import exited_worker_ports


class _Proc:
    def __init__(self, code):
        self.code = code

    def poll(self):
        return self.code


def test_exited_worker_ports_lists_only_dead_processes():
    procs = {5004: _Proc(None), 5005: _Proc(1), 5006: _Proc(0), 5007: _Proc(None)}
    assert exited_worker_ports(procs) == [5005, 5006]


def test_exited_worker_ports_empty_when_all_alive():
    assert exited_worker_ports({5004: _Proc(None)}) == []
