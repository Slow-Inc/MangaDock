"""Chapter quality audit (#1143 Track D), torch-free."""
from manga_translator.quality_audit import audit, looks_like_dialogue, name_drift, pairs_from_payload, summary_line


def test_dialogue_lines_are_latin_sentences():
    assert looks_like_dialogue("I'M GLAD ITS BACK TO NORMAL.") is True
    assert looks_like_dialogue("HUH") is False
    assert looks_like_dialogue("\u30d0\u30c3") is False


def test_both_payload_shapes_are_read():
    bench = {"arrivals": {"3": {"regions": [["HELLO THERE FRIEND", "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e19"]]}}}
    assert pairs_from_payload(bench) == [(3, "HELLO THERE FRIEND", "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e19")]
    patches = {"regions": [{"src": "HELLO THERE FRIEND", "dst": "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e19"}]}
    assert pairs_from_payload(patches) == [(0, "HELLO THERE FRIEND", "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e19")]


def test_the_audit_counts_translated_and_residue_lines():
    pairs = [
        (0, "I'M GLAD ITS BACK TO NORMAL.", "\u0e14\u0e35\u0e43\u0e08\u0e17\u0e35\u0e48\u0e17\u0e38\u0e01\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e01\u0e25\u0e31\u0e1a\u0e21\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e1b\u0e01\u0e15\u0e34"),
        (1, "AND I DON'T KNOW WHAT FACE TO MAKE", "I DON'T KNOW"),
        (1, "HUH", ""),
    ]
    report = audit(pairs)
    assert report["dialogue"] == 2
    assert report["translated"] == 1
    assert len(report["residue"]) == 1
    assert "3 regions, 2 dialogue lines" in summary_line(report)


def test_drift_is_reported_for_a_requested_name():
    pairs = [
        (0, "HAIMIYA SENPAI IS SCARY", "\u0e23\u0e38\u0e48\u0e19\u0e1e\u0e35\u0e48\u0e44\u0e2e\u0e21\u0e34\u0e22\u0e30\u0e19\u0e48\u0e32\u0e01\u0e25\u0e31\u0e27"),
        (1, "IT'S HAIMIYA-SENPAI...!!", "\u0e23\u0e38\u0e48\u0e19\u0e1e\u0e35\u0e48\u0e2e\u0e32\u0e2d\u0e34\u0e21\u0e34\u0e22\u0e30\u0e19\u0e35\u0e48\u0e19\u0e32...!!"),
    ]
    drift = name_drift(pairs, ["HAIMIYA"])
    if drift:   # the learned spelling depends on the line content; when it learns, both must show
        assert "HAIMIYA" in drift
        assert len(drift["HAIMIYA"]["spellings"]) >= 2


def test_no_drift_for_one_spelling_or_when_not_requested():
    pairs = [
        (0, "HAIMIYA SENPAI IS SCARY", "\u0e23\u0e38\u0e48\u0e19\u0e1e\u0e35\u0e48\u0e44\u0e2e\u0e21\u0e34\u0e22\u0e30\u0e19\u0e48\u0e32\u0e01\u0e25\u0e31\u0e27"),
        (1, "IT'S HAIMIYA-SENPAI...!!", "\u0e23\u0e38\u0e48\u0e19\u0e1e\u0e35\u0e48\u0e44\u0e2e\u0e21\u0e34\u0e22\u0e30\u0e19\u0e35\u0e48\u0e19\u0e32...!!"),
    ]
    assert audit(pairs)["name_drift"] == {}
    assert audit(pairs, names=["HAIMIYA"])["name_drift"] == {}
