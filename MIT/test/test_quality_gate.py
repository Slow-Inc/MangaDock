"""Quality-gate checks (#980 follow-up): deterministic detectors over one chapter."""
from manga_translator.quality_gate import check_chapter, check_names, check_page


def _r(src, dst):
    return {"src": src, "dst": dst}


def test_a_clean_page_has_no_violations():
    regions = [_r("HELLO THERE!", "สวัสดี!"), _r("WHERE ARE YOU GOING?", "เธอจะไปไหน?")]
    assert check_page(regions, 'p1') == []


def test_dropped_punctuation_is_flagged_but_an_interrobang_is_accepted():
    kinds = [v["kind"] for v in check_page([_r("WHAT?!", "อะไร")])]
    assert "dropped_?" in kinds and "dropped_!" in kinds
    assert check_page([_r("WHAT?!", "อะไร⁈")]) == []


def test_foreign_script_runaway_and_doubled_marks_are_flagged():
    assert [v["kind"] for v in check_page([_r("TSUKUYOMI!", "ЦУКУโยมิ!")])] == ["foreign_script"]
    long_loop = "แม่นดูหมั้นแม่นดูรัก" * 20
    kinds = [v["kind"] for v in check_page([_r("HI!", long_loop)])]
    assert "runaway" in kinds
    assert [v["kind"] for v in check_page([_r("IS IT?", "ใช่ไหม้้?")])] == ["doubled_mark"]


def test_control_and_latin_leaks_are_flagged():
    assert [v["kind"] for v in check_page([_r("GO!", "ไป\u200b!")])] == ["control_chars"]
    assert "added_latin" in [v["kind"] for v in check_page([_r("HELLO!", "ไปเลย GOING!")])]


def test_inconsistent_name_spellings_are_flagged_across_pages():
    page1 = [_r('TSUKUYOMI!', 'สึกุโยมิ!'), _r('TSUKUYOMI, WAIT!', 'สึกุโยมิ รอเดี๋ยว!')]
    page2 = [_r('TSUKUYOMI!', 'ทสึคุโยมิ!'), _r('TSUKUYOMI, WAIT!', 'ทสึคุโยมิ รอเดี๋ยว!')]
    report = check_chapter([('p1', page1), ('p2', page2)])
    kinds = [v["kind"] for v in report["violations"]]
    assert "inconsistent_name" in kinds
    assert report["ok"] is False


def test_a_consistent_chapter_passes():
    page1 = [_r('TSUKUYOMI!', 'สึกุโยมิ!'), _r('TSUKUYOMI, WAIT!', 'สึกุโยมิ รอเดี๋ยว!')]
    page2 = [_r('TSUKUYOMI!', 'สึกุโยมิ!'), _r('WHAT?', 'อะไร?')]
    report = check_chapter([('p1', page1), ('p2', page2)])
    assert report["violations"] == [] and report["ok"] is True
