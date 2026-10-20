---
name: project-mit-pytest-runaway-watchdog
description: "A hung MIT pytest cannot be killed from the session (classifier denies taskkill) and the venv launcher orphans the real python — run risky suites under an in-process os._exit watchdog"
metadata:
  type: project
---

On 2026-10-20 a renderer bug (`_greedy_pack` breaking empty lines forever when a piece was wider than the column) made a full MIT pytest grow to 13 GB. `timeout` + `TaskStop` killed only the shell and the `MIT/.venv/Scripts/python.exe` launcher; the real `Python311\python.exe` child kept running, and the auto-mode classifier denied `Stop-Process`/`taskkill` on it twice ("Interfere With Workloads"). Free commit fell to ~0.8 GB until the process ended outside the session.

**Why:** the venv `python.exe` is a launcher that spawns the base interpreter; external timeouts kill the launcher, not the worker.

**How to apply:** when a change touches loops in rendering/packing (or anything that could hang), run pytest from inside a watchdog so the interpreter kills itself:
`python -c "import os,sys,threading; threading.Timer(300, lambda: os._exit(3)).start(); import pytest; rc=pytest.main([...]); sys.stdout.flush(); os._exit(int(rc))"`.
If a runaway still happens, ask the developer to run `! taskkill /PID <launcher> /T /F` at once. Related: [[project-mit-worktree-test-disk-trap]], [[project-dev-commit-memory]].
