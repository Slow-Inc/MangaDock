"""Worker subprocess lifecycle for the --start-instance front server (#193).

The front server (port P) launches the translation worker as a subprocess on
P+1. This module owns the two operational guards the inline launch lacked:

- a startup **port-collision check** so an orphaned worker is reported loudly
  instead of the front hanging forever on a `/register` that never comes;
- a robust **terminate-or-kill** used by every shutdown path (signal handler,
  atexit, and the ``__main__`` finally) so the worker can never outlive the
  front (uvicorn overrides our signal handlers, so the signal path alone leaks
  the worker on Ctrl+C).

Pure stdlib (socket/subprocess) — unit-tested without spawning a real worker.
"""
import socket
import subprocess


def port_is_free(host: str, port: int) -> bool:
    """True if ``(host, port)`` can be bound right now (nothing is listening).

    Plain bind, no ``SO_REUSEADDR``, so an actively-listening server (e.g. an
    orphaned worker) reliably reports the port as taken.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def ensure_worker_port_free(worker_host: str, worker_port: int, front_port: int) -> None:
    """Raise a clear RuntimeError if the worker port is already in use.

    Without this the worker subprocess starts, fails to bind, and the front hangs
    forever waiting for a ``/register`` that never comes — the #193 symptom. The
    usual cause is a previous ``--start-instance`` worker orphaned on this port.
    """
    if not port_is_free(worker_host, worker_port):
        raise RuntimeError(
            f"MIT worker port {worker_port} is already in use - a previous "
            f"--start-instance worker is probably still running (orphaned) on it. "
            f"Stop whatever is listening on {worker_port} and restart. The front "
            f"server uses port {front_port} and the worker uses {worker_port}; a "
            f"restart must free BOTH (see MIT/README.md > Worker lifecycle)."
        )


def terminate_process(proc, timeout: float = 5.0) -> None:
    """Stop a worker subprocess, escalating terminate → kill if it lingers.

    Safe to call on ``None`` or an already-exited process (idempotent), so every
    shutdown path (signal handler, atexit, ``__main__`` finally) can call it
    without guards and the worker never orphans on a graceful stop.
    """
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
