"""Unit tests for the --start-instance worker lifecycle guards (#193).

`worker_lifecycle` is pure stdlib (socket/subprocess), so the port check uses a
real loopback socket and the terminate/kill escalation uses a fake process — no
worker subprocess is spawned.
"""
import socket
import subprocess

import pytest

from server import worker_lifecycle as wl


# ---- port_is_free / ensure_worker_port_free ----------------------------------

def test_port_is_free_true_for_an_unbound_port():
    # grab a free port from the OS, release it, then assert it reads as free
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    assert wl.port_is_free('127.0.0.1', port) is True


def test_port_is_free_false_while_a_socket_is_listening():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    s.listen()
    port = s.getsockname()[1]
    try:
        assert wl.port_is_free('127.0.0.1', port) is False
    finally:
        s.close()


def test_ensure_worker_port_free_raises_with_both_ports_in_the_message():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    s.listen()
    worker_port = s.getsockname()[1]
    try:
        with pytest.raises(RuntimeError) as e:
            wl.ensure_worker_port_free('127.0.0.1', worker_port, front_port=worker_port - 1)
        msg = str(e.value)
        assert str(worker_port) in msg
        assert str(worker_port - 1) in msg      # front port mentioned
        assert 'BOTH' in msg                     # tells the operator to free both
    finally:
        s.close()


def test_ensure_worker_port_free_is_a_noop_when_free():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    wl.ensure_worker_port_free('127.0.0.1', port, front_port=port - 1)   # no raise


# ---- terminate_process -------------------------------------------------------

class FakeProc:
    """Minimal stand-in for subprocess.Popen for the terminate/kill paths."""
    def __init__(self, alive=True, wait_times_out=False):
        self._alive = alive
        self._wait_times_out = wait_times_out
        self.terminated = False
        self.killed = False

    def poll(self):
        return None if self._alive else 0

    def terminate(self):
        self.terminated = True
        if not self._wait_times_out:
            self._alive = False

    def wait(self, timeout=None):
        if self._wait_times_out:
            raise subprocess.TimeoutExpired('worker', timeout)
        return 0

    def kill(self):
        self.killed = True
        self._alive = False


def test_terminate_process_terminates_a_live_worker():
    proc = FakeProc(alive=True)
    wl.terminate_process(proc, timeout=0.01)
    assert proc.terminated is True
    assert proc.killed is False


def test_terminate_process_escalates_to_kill_when_terminate_times_out():
    proc = FakeProc(alive=True, wait_times_out=True)
    wl.terminate_process(proc, timeout=0.01)
    assert proc.terminated is True
    assert proc.killed is True


def test_terminate_process_noop_on_already_exited():
    proc = FakeProc(alive=False)
    wl.terminate_process(proc, timeout=0.01)
    assert proc.terminated is False
    assert proc.killed is False


def test_terminate_process_noop_on_none():
    wl.terminate_process(None)      # must not raise
