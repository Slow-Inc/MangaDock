"""Numbered-contract normalizer + determinism gate (Master Plan 2 P7, #526-adjacent).

The GPT-family translators speak a numbered contract: the model returns ``<|1|>line one
<|2|>line two ...`` for N source queries. Real captured failures (defect sweep 2026-07-03):
count mismatch (fewer/more blocks than N), a dropped index, or a garbage/empty block. These
pure functions make the contract *measurable* (for the #526 eval) and repairable at a boundary,
and classify whether a decode config is reproducible (the P7c gate that makes replay/A-B trustworthy).

Stdlib only → sub-second unit tests, no ML.
"""
import pytest

from manga_translator.translators.numbered_contract import (
    OCR_FAILED,
    is_deterministic_decode,
    normalize_numbered_output,
    parse_numbered_blocks,
)


def test_parse_numbered_blocks_maps_index_to_text():
    raw = '<|1|>hello\n<|2|>world'
    assert parse_numbered_blocks(raw) == {1: 'hello', 2: 'world'}


def test_parse_tolerates_leading_preamble_and_blank_lines():
    raw = 'Sure! Here you go:\n\n<|1|>a\n\n<|2|>b\n'
    assert parse_numbered_blocks(raw) == {1: 'a', 2: 'b'}


def test_normalize_returns_exactly_n_in_order():
    raw = '<|1|>one\n<|2|>two\n<|3|>three'
    assert normalize_numbered_output(raw, 3) == ['one', 'two', 'three']


def test_normalize_marks_a_dropped_middle_index():
    # real failure: the model skipped item 2 → without repair the downstream zip shifts everything.
    raw = '<|1|>one\n<|3|>three'
    out = normalize_numbered_output(raw, 3, missing='[Missing item {n}]')
    assert out == ['one', '[Missing item 2]', 'three']


def test_normalize_pads_when_fewer_blocks_than_n():
    raw = '<|1|>only one'
    assert normalize_numbered_output(raw, 3, missing='[Missing item {n}]') == [
        'only one', '[Missing item 2]', '[Missing item 3]']


def test_normalize_truncates_extra_blocks():
    raw = '<|1|>a\n<|2|>b\n<|3|>c\n<|4|>hallucinated'
    assert normalize_numbered_output(raw, 2) == ['a', 'b']


def test_normalize_preserves_ocr_failed_sentinel():
    raw = f'<|1|>{OCR_FAILED}\n<|2|>real'
    assert normalize_numbered_output(raw, 2) == [OCR_FAILED, 'real']


def test_normalize_treats_empty_block_as_missing():
    raw = '<|1|>\n<|2|>real'
    out = normalize_numbered_output(raw, 2, missing='[Missing item {n}]')
    assert out == ['[Missing item 1]', 'real']


def test_normalize_on_unnumbered_single_response():
    # N==1 and the model answered without the tag — accept the whole cleaned body.
    assert normalize_numbered_output('just the translation', 1) == ['just the translation']


@pytest.mark.parametrize('temp,top_p,top_k,expected', [
    (0.0, 1.0, None, True),     # temp 0 → greedy
    (0.0, None, None, True),
    (0.7, 1.0, None, False),    # sampling
    (0.7, 0.0, None, True),     # top_p 0 collapses to greedy
    (0.7, 1.0, 1, True),        # top_k 1 → greedy
    (0.5, 0.9, 40, False),      # typical sampling → NOT reproducible
])
def test_is_deterministic_decode(temp, top_p, top_k, expected):
    assert is_deterministic_decode(temp, top_p, top_k) is expected


def test_parse_response_repairs_dropped_index():
    # live Otome v9: positional re.split ignored the indices — one dropped index
    # shifted EVERY following bubble's translation. _parse_response must map by index.
    from manga_translator.translators.common_gpt import CommonGPTTranslator
    raw = '<|1|>หนึ่ง <|3|>สาม <|4|>สี่'          # model dropped <|2|>
    class _Stub(CommonGPTTranslator):
        def __init__(self): pass
        async def _translate(self, *a, **k): ...
        def count_tokens(self, *a, **k): return 0
    out = _Stub()._parse_response(raw, ['a', 'b', 'c', 'd'])
    assert len(out) == 4
    assert out[0] == 'หนึ่ง'
    assert out[2] == 'สาม'                        # stays at ITS index, not shifted
    assert out[3] == 'สี่'


def test_malformed_marker_missing_closing_angle_still_splits():
    # live full-page Otome: the model emitted "<|10|" (no closing ">") which the strict
    # regex ignored -> the marker leaked into block 9's text AND shifted every later index.
    from manga_translator.translators.numbered_contract import parse_numbered_blocks
    raw = '<|1|>หนึ่ง <|2|>สอง <|3|'                # 3rd marker malformed (no >)
    blocks = parse_numbered_blocks(raw)
    assert blocks.get(1) == 'หนึ่ง'
    assert blocks.get(2) == 'สอง'                    # NOT "สอง <|3|" — no leaked marker


def test_trailing_malformed_markers_stripped_from_text():
    from manga_translator.translators.numbered_contract import normalize_numbered_output
    raw = '<|1|>เริ่มจากตัวเอก <|2|>ถึงอิริส <|3| <|4| <|5|'
    out = normalize_numbered_output(raw, 2)
    assert out[0] == 'เริ่มจากตัวเอก'
    assert out[1] == 'ถึงอิริส'                       # trailing "<|3| <|4| <|5|" stripped
