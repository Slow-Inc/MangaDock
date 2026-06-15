---
name: project-mit-worker-restart-gotcha
description: Restarting the MIT --start-instance worker on Windows — the process is python3.11.exe (not python.exe), so Stop-Process python misses it; kill by PORT OWNER on 5003 AND 5004 or a stale orphan worker keeps serving old code
metadata:
  type: project
---

**Symptom (cost a whole session 2026-06-12):** edited MIT pipeline code, restarted the worker, but the running worker kept serving the OLD code — new `logger.info` lines never appeared, code changes had no effect, and the same `_e2e_mit_*.log` from a *previous* restart kept receiving the worker's `[shared]` log lines.

**Root cause — two compounding gotchas:**
1. **Process name is `python3.11.exe`, not `python.exe`.** `Get-Process python` / `Stop-Process python` (and bash `kill`-by-name) **do not match it** → the kill silently no-ops and the old worker survives.
2. **`--start-instance` runs a 2-process pair**: a FRONT on `0.0.0.0:5003` and a WORKER on `127.0.0.1:5004` (#193). `taskkill /PID <front> /T /F` does **not** reliably take the worker subprocess with it; an **orphaned worker on 5004** lingers and a new front re-attaches to it (or the new front dies with `[Errno 10048]` bind-collision on 5003 / `ensure_worker_port_free` raises on 5004).

**Reliable restart (verified):** kill by **port owner** on BOTH ports until free, then relaunch:
```powershell
for($k=0;$k -lt 4;$k++){ $any=$false
  foreach($p in 5003,5004){ Get-NetTCPConnection -LocalPort $p -State Listen -EA SilentlyContinue |
    ForEach-Object { $any=$true; Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue } }
  if(-not $any){break}; Start-Sleep 3 }
# verify BOTH 5003 and 5004 report 'free' before relaunching
```
Then launch from `MIT/`: `.\.venv\Scripts\python.exe -u server/main.py --host 0.0.0.0 --port 5003 --use-gpu --start-instance`.

**Verify the NEW worker is the one serving:** the worker's `[shared] ...` logs land in the front's stdout redirect, but ONLY for the worker the *current* front spawned. If a log line you expect (e.g. a new `logger.info`) is missing, you're hitting a stale orphan — re-kill by port owner.

**Don't debug MIT pipeline internals through the worker HTTP loop** when you need stage-by-stage visibility — the restart+log indirection is too flaky. Run the pipeline **in-process** (kill the worker to free the GPU first, reliably via port-owner) so `logger.info` prints straight to stdout. See [[project_mit_launch_env]].
