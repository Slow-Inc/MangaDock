"""Plan extra translation workers and pick one per request (Strata-style batch slots), pure and torch-free.

The front server (--start-instance) always starts one worker on front_port + 1. Operators can
ask for more workers so concurrent page requests are served in parallel, and can pin each worker
to a GPU. Both knobs are optional and default to today's single-worker behaviour:

    MIT_WORKERS=2          total workers (1..8)
    MIT_WORKER_GPUS=1,0    per-worker CUDA_VISIBLE_DEVICES, round-robin; worker 1 uses the
                           front server's own CUDA_VISIBLE_DEVICES, extra workers take the rest

Nothing here imports the ML stack, so the planning is unit-tested in milliseconds.
"""
import os
from collections import Counter

MAX_WORKERS = 8
ENV_WORKERS = 'MIT_WORKERS'
ENV_GPUS = 'MIT_WORKER_GPUS'


def parse_worker_count(raw):
    """Total worker count from the env string; invalid or absent -> 1, clamped to 1..MAX_WORKERS."""
    try:
        count = int(str(raw).strip())
    except (TypeError, ValueError):
        return 1
    return max(1, min(count, MAX_WORKERS))


def parse_worker_gpus(raw):
    """Comma-separated CUDA device ids; empty/absent -> [] (every worker inherits the front's GPU)."""
    if not raw:
        return []
    return [part.strip() for part in str(raw).split(',') if part.strip()]


def plan_extra_workers(front_port, count, gpu_ids=None):
    """Extra workers after the primary: port front_port + 1 + i, GPU round-robin over gpu_ids.

    Returns [] for count <= 1, so the default path is byte-identical for callers.
    """
    count = parse_worker_count(count)
    gpu_ids = list(gpu_ids or [])
    specs = []
    for index in range(1, count):
        device = gpu_ids[index % len(gpu_ids)] if gpu_ids else None
        specs.append({'port': int(front_port) + 1 + index, 'device': device})
    return specs


def worker_settings_from_env(env=None):
    """(count, gpu_ids) for the current process environment."""
    env = env if env is not None else os.environ
    return parse_worker_count(env.get(ENV_WORKERS)), parse_worker_gpus(env.get(ENV_GPUS))


def pick_free_worker(workers):
    """Index of the free worker to dispatch to, or None when all are busy (#1119).

    ``workers`` = [(busy, gpu), ...] in registration order; ``gpu`` is any hashable that names one card
    (the front passes ``(ip, CUDA_VISIBLE_DEVICES)``). Strata's replica router sends a request to the
    lowest-load replica; here load = busy workers on the same card, so concurrent pages spread over both
    cards instead of stacking on the first-registered one. Ties keep registration order, so a
    single-device setup dispatches exactly as before.
    """
    load = Counter(gpu for busy, gpu in workers if busy)
    free = (i for i, (busy, _) in enumerate(workers) if not busy)
    return min(free, key=lambda i: load[workers[i][1]], default=None)


def card_key(ip, device):
    """The load key of one GPU: a worker with no CUDA_VISIBLE_DEVICES runs on CUDA device 0 (#1119)."""
    return (ip, device or '0')
