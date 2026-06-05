"""Cooperative cancellation for in-flight batch jobs (Issue #101).

The Backend fires `POST /cancel/{taskId}` when the last SSE listener for a Batch
Job goes away. MIT's background batch loop (`run_batch_with_callbacks`) polls
`is_cancelled()` between pages and stops, and `discard()`s its taskId when the job
finishes (completed or cancelled) so the registry cannot grow unbounded.

A process-global set is sufficient: the web server is a single process, the loop
only ever *polls* the flag (no awaiting), and lookups are O(1).
"""
from typing import Optional

_cancelled: set[str] = set()


def mark_cancelled(task_id: Optional[str]) -> None:
    """Record that a Batch Job (taskId) should stop. No-op for empty taskIds."""
    if task_id:
        _cancelled.add(task_id)


def is_cancelled(task_id: Optional[str]) -> bool:
    return bool(task_id) and task_id in _cancelled


def discard(task_id: Optional[str]) -> None:
    """Forget a taskId. Safe to call for an unknown taskId."""
    _cancelled.discard(task_id)
