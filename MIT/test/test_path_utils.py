"""Unit tests for path traversal guard (Issue #102).

Pure-function tests — no HTTP stack, no filesystem side-effects.
"""
import pytest
from pathlib import Path

from server.path_utils import safe_result_folder

FAKE_ROOT = Path("/fake/result").resolve()


def test_valid_name_returns_path_inside_root():
    p = safe_result_folder(FAKE_ROOT, "abc123")
    assert p == FAKE_ROOT / "abc123"


def test_valid_name_alphanumeric_dash_underscore():
    p = safe_result_folder(FAKE_ROOT, "my-result_2024")
    assert p.parent == FAKE_ROOT


def test_dotdot_rejected():
    with pytest.raises(ValueError):
        safe_result_folder(FAKE_ROOT, "..")


def test_dotdot_in_name_rejected():
    with pytest.raises(ValueError):
        safe_result_folder(FAKE_ROOT, "../etc")


def test_forward_slash_rejected():
    with pytest.raises(ValueError):
        safe_result_folder(FAKE_ROOT, "a/b")


def test_backslash_rejected():
    with pytest.raises(ValueError):
        safe_result_folder(FAKE_ROOT, "a\\b")


def test_empty_name_rejected():
    with pytest.raises(ValueError):
        safe_result_folder(FAKE_ROOT, "")
