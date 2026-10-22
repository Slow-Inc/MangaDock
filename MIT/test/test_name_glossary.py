"""#980: cross-page character-name glossary — extraction and prompt formatting, pure logic."""
from manga_translator.name_glossary import (apply_glossary, candidate_names, count_candidates, extract_glossary,
                                            format_glossary, glossary_enabled)


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
