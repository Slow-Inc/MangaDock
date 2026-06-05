"""Unit tests for the batch-job cancellation registry (Issue #101).

Pure logic, no ML imports — imports in <1s.
"""
import pytest

from server import cancellation


@pytest.fixture(autouse=True)
def _clean_registry():
    cancellation._cancelled.clear()
    yield
    cancellation._cancelled.clear()


def test_unknown_task_is_not_cancelled():
    assert cancellation.is_cancelled("ch:ANY:THA") is False


def test_mark_then_is_cancelled():
    cancellation.mark_cancelled("ch:ANY:THA")
    assert cancellation.is_cancelled("ch:ANY:THA") is True


def test_discard_clears_cancellation():
    cancellation.mark_cancelled("ch:ANY:THA")
    cancellation.discard("ch:ANY:THA")
    assert cancellation.is_cancelled("ch:ANY:THA") is False


def test_discard_unknown_is_safe():
    cancellation.discard("never-registered")  # must not raise


def test_mark_empty_taskid_is_ignored():
    cancellation.mark_cancelled("")
    cancellation.mark_cancelled(None)
    assert cancellation.is_cancelled("") is False


def test_tasks_are_independent():
    cancellation.mark_cancelled("a")
    assert cancellation.is_cancelled("a") is True
    assert cancellation.is_cancelled("b") is False
