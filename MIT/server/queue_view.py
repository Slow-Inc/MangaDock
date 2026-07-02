"""Pure transform: the parent's TaskQueue contents → the Dev-console snapshot's
`queue.jobs`. Import-light (no PIL / Config / ML stack, unlike server.myqueue) so it
unit-tests in <1s; server.myqueue extracts the plain fields and calls this.

Honest about scope: the parent only knows what the patch path carries — `taskId` and
`pageIndex` from `progress_meta`, plus the task_type and enqueue time. There is no
user / manga / chapter at this layer, so those are not invented.
"""


def job_view(raw: dict, now: float) -> dict:
    """`raw` = {id, task_type, progress_meta, enqueued_at}. `now`/`enqueued_at` share a
    clock (monotonic). Queued jobs only — the TaskQueue holds tasks until dispatch."""
    pm = raw.get("progress_meta") or {}
    enq = raw.get("enqueued_at")
    return {
        "id": str(raw.get("id")),
        "task_type": raw.get("task_type", "translate"),
        "task_id": pm.get("taskId"),
        "page_index": pm.get("pageIndex"),
        "state": "queued",
        "waiting_ms": int((now - enq) * 1000) if enq is not None else None,
    }


def jobs_view(raws, now: float) -> list[dict]:
    return [job_view(r, now) for r in raws]
