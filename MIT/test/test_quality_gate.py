"""Quality-gate checks (#980 follow-up): deterministic detectors over one chapter."""
from manga_translator.quality_gate import check_chapter, check_names, check_page


def _r(src, dst):
    return {"src": src, "dst": dst}


def test_a_clean_page_has_no_violations():
    regions = [_r("HELLO THERE!", "สวัสดี!"), _r("WHERE ARE YOU GOING?", "เธอจะไปไหน?")]
    assert check_page(regions, 'p1') == []


def test_dropped_punctuation_is_flagged_but_an_interrobang_is_accepted():
    kinds = [v["kind"] for v in check_page([_r("WHAT?!", "ไปแล้ว")])]
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


def test_a_thai_question_particle_covers_a_dropped_question_mark():
    assert check_page([_r("YOURE COMING?", "เธอจะมางั้นเหรอ")]) == []
    assert check_page([_r("YOURE COMING?", "เธอจะมาไหม")]) == []
    assert [v["kind"] for v in check_page([_r("YOURE COMING?", "เธอจะมา")])] == ["dropped_?"]


def test_a_punctuation_marble_inside_an_ocr_word_is_not_a_question_990e():
    assert check_page([_r("IF?YOU THINK ABOUT THATS QUITE SAD.", "ถ้าคิดแบบนั้น ก็ถือว่าเศร้ามากเลยนะ")]) == []
    assert [v["kind"] for v in check_page([_r("WHY? ARE YOU SURE?", "เธอแน่ใจมาก")])] == ["dropped_?"]


def test_a_question_mark_covers_an_exclamation_in_thai_990f():
    assert check_page([_r("IT WONT KILL ME?!", "มันจะฆ่าข้าไม่ได้งั้นเหรอ?")]) == []


def test_ocr_punctuation_between_letters_and_digits_is_not_a_question_990g():
    assert check_page([_r("Episode?3", "ตอนที่ 3")]) == []


def test_latin_names_shared_with_the_source_are_not_an_added_language_990h():
    assert check_page([_r("TRANSLATED BY DALE", "แปลโดย DALE")]) == []
    assert check_page([_r("TYPESETTING BY RTSD, ZERO", "จัดหน้าโดย RTSD, ZERO")]) == []
    assert [v["kind"] for v in check_page([_r("GO!", "ไปเลย GOING!")])] == ["added_latin"]


def test_question_words_near_the_end_also_cover_a_dropped_mark_990i():
    assert check_page([_r("DO YOU KNOW WHAT A DEMON LORD IS?", "รู้ไหมว่าจอมมารคืออะไร")]) == []
    assert check_page([_r("ARENT THEY THE STRONGEST WIZARDS?", "พวกเขาไม่ใช่จอมเวทที่เก่งกาจที่สุดหรือไง")]) == []
    assert check_page([_r("WHAT SHOULD I DO?", "ฉันควรทำอะไรสักอย่าง")]) == []  # อะไร mid-sentence is accepted as a question marker

def test_a_question_marker_early_in_a_long_answer_counts_1056c():
    """#1056: the question particle can sit anywhere in a long sentence, not only the last 16 chars."""
    from manga_translator.quality_gate import check_page
    v = check_page([{"src": "IS THAT REALLY TRUE? I CANT BELIEVE IT AT ALL",
                    "dst": "หรือว่ามันจะเป็นเรื่องจริง ฉันไม่อยากจะเชื่อเลยสักนิด"}])
    assert not any(x["kind"] == "dropped_?" for x in v), v


def test_the_gate_flags_content_loss_1058():
    from manga_translator.quality_gate import check_page
    v = check_page([{"src": "MAY THE BLESSINGS OF THE GREAT", "dst": "ขอพรจากมหา"}])
    assert any(x["kind"] == "content_loss" for x in v), v


def test_the_gate_flags_a_word_kept_in_english_1057():
    from manga_translator.quality_gate import check_page
    v = check_page([{"src": "DID ANYONE BRING THE RESOURCE MATERIALS?", "dst": "มีใครเอามATERIALS มาบ้างไหม?"}])
    assert any(x["kind"] == "untranslated_word" for x in v), v

def test_a_dropped_region_with_no_translation_is_not_a_violation_535():
    from manga_translator.quality_gate import check_page
    v = check_page([{'src': '、題', 'dst': '', 'rendered': False, 'drop_reason': 'source language filter'}])
    assert not v, v
    v2 = check_page([{'src': 'REAL LINE', 'dst': ''}])
    assert any(x['kind'] == 'empty_translation' for x in v2), v2

def test_the_gate_flags_a_common_thai_typo_1023():
    from manga_translator.quality_gate import check_page
    v = check_page([{"src": "IS THAT SO", "dst": "ใช่แล่ว."}])
    assert any(x["kind"] == "common_typo" for x in v), v
    clean = check_page([{"src": "IS THAT SO", "dst": "ใช่แล้ว."}])
    assert not clean, clean


def test_tag_questions_are_licensed_in_the_gate_1025():
    from manga_translator.quality_gate import check_page
    assert check_page([{'src': 'ITS JUST AINT FAIR, YKNOW?', 'dst': 'มันไม่แฟร์เลยนะเนี่ย!'}]) == []
    viol = check_page([{'src': 'IS THAT SO?', 'dst': 'มันเป็นอย่างนั้นจริงๆ'}])
    assert any(v['kind'] == 'dropped_?' for v in viol), viol


def test_exclamation_carried_by_a_thai_emphasis_particle_1032():
    from manga_translator.quality_gate import check_page
    # measured: the source '!' is conveyed by จริงๆ; the gate must not call it dropped
    assert check_page([{'src': 'THOSE GODDESSES ARE TRULY AWFUL!', 'dst': 'ไอ้เทพธิดาพวกนั้นมันแย่จริงๆ'}]) == []
    viol = check_page([{'src': 'THOSE GODDESSES ARE TRULY AWFUL!', 'dst': 'ไอ้เทพธิดาพวกนั้นมันแย่'}])
    assert any(v['kind'] == 'dropped_!' for v in viol), viol


def test_rhetorical_retorts_are_not_flagged_for_dropped_question_1033():
    from manga_translator.quality_gate import check_page
    retort = {'src': 'FOR NO REASON? I WONT LEND TO PEOPLE WHO SAY THAT.', 'dst': 'ไม่มีเหตุผลเลย! ฉันจะไม่ให้ยืม'}
    assert check_page([retort]) == []
    real = check_page([{'src': 'IS THAT SO?', 'dst': 'มันเป็นอย่างนั้นจริงๆ'}])
    assert any(v['kind'] == 'dropped_?' for v in real), real
