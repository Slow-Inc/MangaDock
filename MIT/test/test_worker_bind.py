"""Tests for worker subprocess bind host (Issue #103).

Verifies that the worker is always told to bind loopback regardless of what
host the front server uses.
"""
import sys
from argparse import Namespace
from unittest.mock import patch

from server.main import _build_worker_cmd


def _params(**kw) -> Namespace:
    defaults = dict(
        use_gpu=False, use_gpu_limited=False, ignore_errors=False,
        verbose=False, models_ttl=None, pre_dict=None, post_dict=None,
    )
    defaults.update(kw)
    return Namespace(**defaults)


def test_worker_always_binds_loopback_when_front_binds_all():
    cmd = _build_worker_cmd(_params(), port=5004, nonce="abc")
    host_idx = cmd.index("--host") + 1
    assert cmd[host_idx] == "127.0.0.1"


def test_worker_always_binds_loopback_when_front_binds_specific_ip():
    cmd = _build_worker_cmd(_params(), port=5004, nonce="abc")
    host_idx = cmd.index("--host") + 1
    assert cmd[host_idx] == "127.0.0.1"


def test_worker_cmd_includes_port():
    cmd = _build_worker_cmd(_params(), port=5004, nonce="secret")
    port_idx = cmd.index("--port") + 1
    assert cmd[port_idx] == "5004"


def test_worker_cmd_includes_nonce():
    cmd = _build_worker_cmd(_params(), port=5004, nonce="mynonce")
    nonce_idx = cmd.index("--nonce") + 1
    assert cmd[nonce_idx] == "mynonce"


def test_worker_cmd_no_gpu_flags_by_default():
    cmd = _build_worker_cmd(_params(), port=5004, nonce="abc")
    assert "--use-gpu" not in cmd
    assert "--use-gpu-limited" not in cmd


def test_worker_cmd_gpu_flag_propagated():
    cmd = _build_worker_cmd(_params(use_gpu=True), port=5004, nonce="abc")
    assert "--use-gpu" in cmd
