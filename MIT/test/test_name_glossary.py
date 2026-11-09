"""#980: cross-page character-name glossary — extraction and prompt formatting, pure logic."""
from manga_translator.name_glossary import (_same_name_skeleton, apply_glossary, candidate_names,
                                            count_candidates, extract_glossary, format_glossary,
                                            glossary_enabled, learn_spellings)


def test_candidate_names_finds_romaji_names_and_joins_hyphenated_ones():
    srcs = ["TSUKU- YOMI, WAIT!", "Even TSUKUYOMI is here", "PLICIA has a cheerful personality"]
    found = candidate_names(srcs)
    assert "TSUKUYOMI" in found, found
    assert "PLICIA" in found, found


def test_candidate_names_skips_common_words():
    found = candidate_names(["WHAT DO YOU MEAN BY THAT?", "THEY ARE ALL THE SAME"])
    assert not [n for n in found if n in ('WHAT', 'DO', 'YOU', 'MEAN', 'THEY', 'ARE', 'ALL', 'THE', 'SAME')], found


def test_extract_glossary_pairs_a_name_with_its_thai_spelling():
    regions = [
        {"src": "TSUKU- YOMI!", "dst": "ทสึคุโยมิ!"},
        {"src": "TSUKUYOMI, WAIT!", "dst": "ทสึคุโยมิ รอเดี๋ยว!"},
        {"src": "WHAT?", "dst": "อะไรนะ?"},
    ]
    glossary = extract_glossary(regions)
    assert glossary.get("TSUKUYOMI") == "ทสึคุโยมิ", glossary


def test_an_existing_spelling_wins_over_a_new_one():
    regions = [
        {"src": "TSUKUYOMI!", "dst": "ทสึคุโยมิ!"},
        {"src": "TSUKUYOMI!", "dst": "สึกุโยมิ!"},
    ]
    assert extract_glossary(regions, existing={"TSUKUYOMI": "สึกุโยมิ"}).get("TSUKUYOMI") == "สึกุโยมิ"


def test_a_region_with_two_names_is_not_used_for_extraction():
    regions = [{"src": "TSUKUYOMI AND PLICIA", "dst": "ทสึคุโยมิกับพลิเซีย"}]
    assert extract_glossary(regions) == {}


def test_format_glossary_renders_a_prompt_block_and_empty_is_blank():
    block = format_glossary({"TSUKUYOMI": "ทสึคุโยมิ"})
    assert "TSUKUYOMI = ทสึคุโยมิ" in block
    assert "character names" in block
    assert format_glossary({}) == ""


def test_extraction_reads_a_textblock_like_object_via_translation_980():
    from types import SimpleNamespace
    region = SimpleNamespace(text="TSUKU- YOMI!", translation="ทสึคุโยมิ!")
    assert extract_glossary([region]).get("TSUKUYOMI") == "ทสึคุโยมิ"


def test_count_candidates_counts_occurrences_per_page_980():
    from types import SimpleNamespace
    regions = [
        SimpleNamespace(text="TSUKUYOMI!", translation="x"),
        SimpleNamespace(text="TSUKUYOMI, WAIT!", translation="y"),
        SimpleNamespace(text="WHAT?", translation="z"),
    ]
    counts = count_candidates(regions)
    assert counts.get("TSUKUYOMI") == 2


def _regions(*pairs):
    from types import SimpleNamespace
    return [SimpleNamespace(text=s, translation=t) for s, t in pairs]


def test_apply_glossary_fixes_a_near_variant_spelling_980():
    regions = _regions(('TSUKUYOMI!', 'ทสึคิโยมิ!'))
    fixed = apply_glossary(regions, {"TSUKUYOMI": "ทสึคุโยมิ"})
    assert fixed == 1
    assert regions[0].translation == 'ทสึคุโยมิ!'


def test_apply_glossary_leaves_an_exact_spelling_alone_980():
    regions = _regions(('TSUKUYOMI!', 'ทสึคุโยมิ!'))
    assert apply_glossary(regions, {"TSUKUYOMI": "ทสึคุโยมิ"}) == 0
    assert regions[0].translation == 'ทสึคุโยมิ!'


def test_apply_glossary_does_not_touch_unrelated_thai_980():
    regions = _regions(('TSUKUYOMI, WAIT!', 'เทพธิดา รอเดี๋ยว!'))
    assert apply_glossary(regions, {"TSUKUYOMI": "ทสึคุโยมิ"}) == 0


def test_apply_glossary_only_touches_regions_whose_source_has_the_name_980():
    regions = _regions(('WHERE IS SHE?', 'ทสึคิโยมิอยู่ไหน'))
    assert apply_glossary(regions, {"TSUKUYOMI": "ทสึคุโยมิ"}) == 0


def test_the_glossary_is_on_by_default_and_can_be_disabled_980():
    assert glossary_enabled({}) is True
    assert glossary_enabled({'MIT_NAME_GLOSSARY': '1'}) is True
    assert glossary_enabled({'MIT_NAME_GLOSSARY': '0'}) is False
    assert glossary_enabled({'MIT_NAME_GLOSSARY': 'false'}) is False
    assert glossary_enabled({'MIT_NAME_GLOSSARY': 'off'}) is False


def test_apply_glossary_fixes_a_realistic_vowel_consonant_drift_980():
    # observed drift on real pages: ทสึคิโยมิ for ทสึคุโยมิ (2 substitutions + 1 insertion)
    regions = _regions(('TSUKUYOMI!', 'ทสึคิโยมิ!'))
    assert apply_glossary(regions, {"TSUKUYOMI": "ทสึคุโยมิ"}) == 1
    assert regions[0].translation == 'ทสึคุโยมิ!'


def test_a_clause_longer_than_a_name_is_not_a_spelling_980b():
    regions = [
        {"src": "SHES!", "dst": "เธอเป็นแบบนี้แม้ไม่มีใครจับตามองก็ตาม"},
    ]
    assert extract_glossary(regions) == {}


def test_common_contraction_words_are_not_name_candidates_980b():
    found = candidate_names(["SHES GOT IT", "IVE SEEN THAT", "YOURE LATE"])
    assert "SHES" not in found and "IVE" not in found and "YOURE" not in found


def test_candidate_names_finds_katakana_names_for_jp_sources_980c():
    found = candidate_names(["アリス、こっちだ！", "リリスの部屋"])
    assert "アリス" in found and "リリス" in found
    assert not [n for n in found if n in ("こっち", "部屋")], found


def test_extract_glossary_pairs_a_katakana_name_with_its_thai_spelling_980c():
    # extraction takes the longest Thai run of a region whose output is essentially the name alone
    regions = [
        {"src": "アリス、こっちだ！", "dst": "อลิส!"},
        {"src": "アリスはどこ？", "dst": "อลิส?"},
    ]
    assert extract_glossary(regions).get("アリス") == "อลิส"


def test_common_manga_words_are_not_name_candidates_980d():
    found = candidate_names(["MAN, YOURE FAMOUS", "OPENS AT 3", "RUNS FAST", "SKY IS BLUE", "SIT DOWN"])
    for junk in ("MAN", "FAMOUS", "OPENS", "RUNS", "SKY", "SIT"):
        assert junk not in found, (junk, found)


def test_real_names_survive_the_common_word_filter_980d():
    found = candidate_names(["TSUKUYOMI!", "MIYAMURA, WAIT!", "HORI SHOW ME"])
    assert "TSUKUYOMI" in found and "MIYAMURA" in found and "HORI" in found

def test_laughter_and_sfx_are_not_name_candidates_1031():
    from manga_translator.name_glossary import candidate_names, extract_glossary, is_interjection_source
    assert is_interjection_source('HEHE.')
    assert is_interjection_source('NYA')
    assert not is_interjection_source('TSUKUYOMI')
    assert candidate_names(['HEHE.']) == []
    assert candidate_names(['NYA']) == []
    assert candidate_names(['TSUKUYOMI']) == ['TSUKUYOMI']
    assert extract_glossary([{'src': 'HEHE.', 'dst': 'เข่า'}]) == {}
    assert extract_glossary([{'src': 'TSUKUYOMI!', 'dst': 'สึคุโยมิ!'}]) == {'TSUKUYOMI': 'สึคุโยมิ'}


def test_apply_glossary_fixes_a_variant_that_contains_the_spelling_1065():
    from manga_translator.name_glossary import apply_glossary

    class R:
        text = 'TSUKUYOMI?'
        translation = 'ทสึคุโยมิ?'

    regions = [R()]
    fixed = apply_glossary(regions, {'TSUKUYOMI': 'สึคุโยมิ'})
    assert fixed == 1
    assert regions[0].translation == 'สึคุโยมิ?'

    exact = R()
    exact.translation = 'สึคุโยมิ?'
    assert apply_glossary([exact], {'TSUKUYOMI': 'สึคุโยมิ'}) == 0  # already exact: untouched

def test_an_inline_hyphen_is_a_separator_not_a_line_break_1143():
    # HAIMIYA-SENPAI must be the name HAIMIYA plus the address word, not one fused candidate that can never
    # match the same character written on another page (measured on Haimiya ch. 6).
    found = candidate_names(["HAIMIYA-SENPAI IS SCARY"])
    assert "HAIMIYA" in found, found
    assert not [n for n in found if n.startswith("HAIMIYA") and n != "HAIMIYA"], found
    assert "SENPAI" not in found, found


def test_learn_spellings_reads_names_only_mentioned_inside_sentences_1143():
    # the existing extraction only reads name-focused lines, so Haimiya (always inside a full sentence) never
    # entered the glossary and its spelling drifted
    regions = [
        {"src": "AND I DON'T KNOW WHAT FACE TO MAKE WHEN I SEE HAIMIYA-SENPAI",
         "dst": "แล้วฉันก็ไม่รู้ว่าควรทำหน้ายังไงเวลาเจอรุ่นพี่ไฮมิยะ..."},
        {"src": "IT'S HAIMIYA-SENPAI...!!", "dst": "รุ่นพี่ไฮมิยะนี่นา...!!"},
        {"src": "I RUSHED HOME AFTER THAT INCIDENT...", "dst": "หลังจากเรื่องวันนั้น... ฉันก็รีบกลับบ้านทันที..."},
    ]
    learned = learn_spellings(regions)
    assert learned.get("HAIMIYA") == "ไฮมิยะ", learned


def test_apply_glossary_fixes_the_variant_inside_an_unspaced_run_1143():
    # Thai has no spaces: the variant sits inside "รุ่นพี่ฮาอิมิยะเอามาคืน" and the old whole-run comparison
    # could never see it
    regions = [{"src": "Returned by Haimiya-Senpai", "dst": "รุ่นพี่ฮาอิมิยะเอามาคืน"}]
    fixed = apply_glossary(regions, {"HAIMIYA": "ไฮมิยะ"})
    assert fixed == 1
    assert "ไฮมิยะ" in regions[0]["dst"] and "ฮาอิมิยะ" not in regions[0]["dst"]


def test_skeleton_matching_separates_name_variants_from_other_words_1143():
    assert _same_name_skeleton("ฮาอิมิยะ", "ไฮมิยะ") is True
    assert _same_name_skeleton("รุ่นพี่", "ไฮมิยะ") is False

def test_a_window_cannot_open_on_a_trailing_vowel_1143():
    # "าไฮมิยะ" was picked out of "รุ่นพี่ไฮมิยะ" because it is closer in length to "ฮาอิมิยะ"; a syllable cannot
    # start on า, so the matcher must reject it and pick the real spelling instead.
    from manga_translator.name_glossary import _find_near_spelling

    best, _ratio = _find_near_spelling("รุ่นพี่ไฮมิยะน่ากลัว", "ฮาอิมิยะ")
    assert best == "ไฮมิยะ", best
