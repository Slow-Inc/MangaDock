"""Tests for the optional gateway header parser."""
from manga_translator.extra_headers import parse_extra_headers


def test_parses_a_json_object():
    assert parse_extra_headers('{"x-opencode-session": "abc"}') == {"x-opencode-session": "abc"}


def test_invalid_or_empty_input_is_ignored():
    assert parse_extra_headers("") == {}
    assert parse_extra_headers("   ") == {}
    assert parse_extra_headers("not json") == {}
    assert parse_extra_headers('["x"]') == {}
    assert parse_extra_headers("null") == {}


def test_values_are_stringified():
    assert parse_extra_headers('{"a": 1, "b": true}') == {"a": "1", "b": "True"}
