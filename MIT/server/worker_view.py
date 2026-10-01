"""Pure transform: the parent's executor registry → the Dev-console snapshot's
`workers.detail` (one row per registered worker: ip/port/pid/busy/uptime). Import-light
(no PIL / Config / ML stack, unlike server.instance) so it unit-tests in <1s.

`pid` is reported by the worker at registration (os.getpid); `registered_at` is stamped
parent-side when the worker registers, so uptime is a real wall of how long it's been up.
"""


def worker_view(raw: dict, now: float) -> dict:
    """`raw` = {ip, port, pid, busy, registered_at}; `now`/`registered_at` share a clock
    (monotonic). uptime_s is None until the worker has registered."""
    reg = raw.get("registered_at")
    return {
        "ip": raw.get("ip"),
        "port": raw.get("port"),
        "pid": raw.get("pid"),
        "busy": bool(raw.get("busy")),
        "uptime_s": round(now - reg) if reg is not None else None,
    }


def workers_detail(raws, now: float) -> list[dict]:
    return [worker_view(r, now) for r in raws]
