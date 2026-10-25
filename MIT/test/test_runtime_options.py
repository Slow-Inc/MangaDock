"""Tests for the runtime option resolvers."""
from manga_translator.runtime_options import resolve_reasoning_effort


def test_accepts_known_efforts():
    for value in ("minimal", "low", "medium", "high", " HIGH "):
        assert resolve_reasoning_effort({"CUSTOM_OPENAI_REASONING_EFFORT": value}) == value.strip().lower()


def test_unknown_or_empty_is_ignored():
    assert resolve_reasoning_effort({}) == ""
    assert resolve_reasoning_effort({"CUSTOM_OPENAI_REASONING_EFFORT": ""}) == ""
    assert resolve_reasoning_effort({"CUSTOM_OPENAI_REASONING_EFFORT": "turbo"}) == ""

def test_none_is_passed_through_not_dropped():
    # #1119: "none" was silently dropped, so the gateway fell back to its default (heavier) reasoning:
    # on MIT's real prompt reasoning_effort=none gives 0 reasoning tokens and ~4-5 s vs 8-49 s at "low".
    assert resolve_reasoning_effort({"CUSTOM_OPENAI_REASONING_EFFORT": "none"}) == "none"
