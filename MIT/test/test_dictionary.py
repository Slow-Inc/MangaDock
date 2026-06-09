"""Post-translation dictionary stage (#187 seam S8).

`load_dictionary` / `apply_dictionary` (pure regex helpers) are moved verbatim off the
god object into `dictionary` so `apply_post_dictionary` — which folds the duplicated
"apply post-dict to every region's translation + log the replacements" block from the
single and batch paths — can be tested without the ML stack.
"""
import logging
from types import SimpleNamespace

from manga_translator.dictionary import (
    apply_dictionary,
    apply_post_dictionary,
    load_dictionary,
)


def _region(translation):
    return SimpleNamespace(translation=translation)


def test_apply_post_dictionary_replaces_in_place_and_returns_changes(tmp_path):
    d = tmp_path / "post.txt"
    d.write_text("foo bar\n", encoding="utf-8")  # pattern 'foo' -> value 'bar'
    r1 = _region("foo baz")
    r2 = _region("unchanged")
    changed = apply_post_dictionary([r1, r2], str(d))
    assert r1.translation == "bar baz"
    assert r2.translation == "unchanged"
    assert changed == ["foo baz => bar baz"]  # only the changed region is reported


def test_token_delete_entry_removes_the_match(tmp_path):
    d = tmp_path / "post.txt"
    d.write_text("spam\n", encoding="utf-8")  # single token -> delete (replace with '')
    r = _region("spam eggs")
    changed = apply_post_dictionary([r], str(d))
    assert r.translation == " eggs"
    assert changed == ["spam eggs =>  eggs"]


def test_logs_summary_header_and_each_replacement(tmp_path, caplog):
    d = tmp_path / "post.txt"
    d.write_text("foo bar\n", encoding="utf-8")
    with caplog.at_level(logging.INFO, logger='manga_translator'):
        apply_post_dictionary([_region("foo")], str(d))
    msgs = [rec.message for rec in caplog.records]
    assert "Post-translation replacements:" in msgs
    assert "foo => bar" in msgs
    assert "No post-translation replacements made." not in msgs


def test_logs_no_replacements_message_when_nothing_changes(tmp_path, caplog):
    d = tmp_path / "post.txt"
    d.write_text("foo bar\n", encoding="utf-8")
    with caplog.at_level(logging.INFO, logger='manga_translator'):
        changed = apply_post_dictionary([_region("nothing matches")], str(d))
    assert changed == []
    msgs = [rec.message for rec in caplog.records]
    assert "No post-translation replacements made." in msgs
    assert "Post-translation replacements:" not in msgs


def test_empty_or_missing_dict_path_is_a_noop(tmp_path):
    # load_dictionary returns [] for a falsy / non-existent path → no changes
    r = _region("untouched")
    assert apply_post_dictionary([r], "") == []
    assert r.translation == "untouched"


def test_moved_helpers_still_parse_and_apply(tmp_path):
    # load_dictionary / apply_dictionary moved verbatim — characterize the parse:
    # comments stripped, blank lines ignored, single-token delete, two-token replace
    d = tmp_path / "dict.txt"
    d.write_text("# header\n\nfoo bar  // inline comment\nbaz\n", encoding="utf-8")
    parsed = load_dictionary(str(d))
    assert len(parsed) == 2  # the comment + blank lines are skipped
    assert apply_dictionary("foo baz", parsed) == "bar "  # foo->bar, baz->''
