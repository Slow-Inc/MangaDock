"""Tests for the runtime option resolvers."""
from manga_translator.runtime_options import resolve_reasoning_effort


def test_accepts_known_efforts():
    for value in ("minimal", "low", "medium", "high", " HIGH "):
        assert resolve_reasoning_effort({"CUSTOM_OPENAI_REASONING_EFFORT": value}) == value.strip().lower()


def test_unknown_or_empty_is_ignored():
    assert resolve_reasoning_effort({}) == ""
    assert resolve_reasoning_effort({"CUSTOM_OPENAI_REASONING_EFFORT": ""}) == ""
    assert resolve_reasoning_effort({"CUSTOM_OPENAI_REASONING_EFFORT": "turbo"}) == ""