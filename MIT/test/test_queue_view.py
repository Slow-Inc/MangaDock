"""Unit tests for server.queue_view — the pure transform from the parent's TaskQueue
contents into the Dev-console snapshot's `queue.jobs`. Kept import-light (no PIL / no ML
stack, unlike server.myqueue) so it runs in <1s."""

from server.queue_view import job_view, jobs_view


def test_job_view_surfaces_only_what_the_parent_knows():
    raw = {"id": 7, "task_type": "translate_patches",
           "progress_meta": {"taskId": "abc", "pageIndex": 3, "secret": "x"}, "enqueued_at": 100.0}
    assert job_view(raw, now=101.5) == {
        "id": "7", "task_type": "translate_patches", "task_id": "abc",
        "page_index": 3, "state": "queued", "waiting_ms": 1500,
    }


def test_job_view_tolerates_missing_progress_meta():
    raw = {"id": 1, "task_type": "translate", "progress_meta": None, "enqueued_at": 50.0}
    v = job_view(raw, now=50.0)
    assert v["task_id"] is None and v["page_index"] is None and v["waiting_ms"] == 0


def test_job_view_waiting_ms_is_none_without_an_enqueue_time():
    v = job_view({"id": 2, "task_type": "translate", "progress_meta": {}, "enqueued_at": None}, now=99.0)
    assert v["waiting_ms"] is None


def test_jobs_view_maps_the_whole_queue_in_order():
    raws = [
        {"id": 1, "task_type": "translate", "progress_meta": {"pageIndex": 0}, "enqueued_at": 10.0},
        {"id": 2, "task_type": "translate", "progress_meta": {"pageIndex": 1}, "enqueued_at": 11.0},
    ]
    out = jobs_view(raws, now=12.0)
    assert [j["id"] for j in out] == ["1", "2"]
    assert [j["page_index"] for j in out] == [0, 1]
