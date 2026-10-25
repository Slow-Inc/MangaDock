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
