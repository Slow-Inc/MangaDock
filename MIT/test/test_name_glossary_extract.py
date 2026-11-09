"""Name-glossary extraction: name-focused lines only (#980, #990 follow-up)."""
import pytest


def test_a_clause_line_is_not_used():
    pytest.importorskip("manga_translator.name_glossary")
    from manga_translator.name_glossary import extract_glossary
    regions = [{"src": "TSUKUYOMI IS HERE.", "dst": "สึกุโยมิอยู่ที่นี่"}]
    assert extract_glossary(regions) == {}


def test_a_name_only_line_is_used():
    from manga_translator.name_glossary import extract_glossary
    regions = [{"src": "TSUKUYOMI!", "dst": "สึกุโยมิ!"}]
    assert extract_glossary(regions) == {"TSUKUYOMI": "สึกุโยมิ"}
