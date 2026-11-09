"""#1119: Windows process hygiene ported from Strata-xeno's serve/winjob.py (real Win32 calls, no mocks)."""
import os
import subprocess
import sys
import time

import pytest

from server import win_process

windows_only = pytest.mark.skipif(os.name != "nt", reason="Win32 job objects / EcoQoS")


@windows_only
def test_no_throttle_is_accepted_for_this_process():
    assert win_process.no_throttle() is True


@windows_only
def test_contained_child_dies_when_the_job_closes():
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    try:
        assert win_process.contain(child) is True
        win_process._k32.CloseHandle(win_process._job)   # what happens when the front dies, even force-killed
        win_process._job = None
        deadline = time.time() + 10
        while child.poll() is None and time.time() < deadline:
            time.sleep(0.1)
        assert child.poll() is not None
    finally:
        if child.poll() is None:
            child.kill()


def test_contain_none_is_a_harmless_no():
    assert win_process.contain(None) is False


@windows_only
def test_a_process_in_its_own_job_takes_its_grandchildren_down_when_killed():
    # The front joins the job itself (contain_self) before spawning, so the venv launcher AND the interpreter it
    # starts are born inside the job: no window where a grandchild escapes (#1118 review of eff473e9).
    code = ("import subprocess, sys, time\n"
            "from server import win_process\n"
            "assert win_process.contain_self()\n"
            "g = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])\n"
            "print(g.pid, flush=True)\n"
            "time.sleep(60)\n")
    parent = subprocess.Popen([sys.executable, "-c", code], stdout=subprocess.PIPE, text=True,
                              cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    grandchild = int(parent.stdout.readline())
    parent.kill()                                      # what a force-kill of the front does
    parent.wait(10)
    import psutil
    deadline = time.time() + 10
    while psutil.pid_exists(grandchild) and time.time() < deadline:
        time.sleep(0.1)
    alive = psutil.pid_exists(grandchild)
    if alive:
        psutil.Process(grandchild).kill()
    assert not alive
