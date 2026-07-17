"""#535 root: CustomOpenAiTranslator parsed its own response inline (positional
re.split, strict <|d|> regex) — a malformed marker '<|10|' leaked into text and
one dropped index shifted every later bubble (live full-page Otome: DAMN got
IRIS-CHAN's line + trailing '<|12| <|13|'). The parse is now index-based +
malformed-marker tolerant via numbered_contract."""
from manga_translator.translators.custom_openai import parse_numbered_translations


def test_index_based_mapping_survives_dropped_index():
    resp = '<|1|>หนึ่ง <|3|>สาม'                     # <|2|> dropped
    out = parse_numbered_translations(resp, 3)
    assert out[0] == 'หนึ่ง'
    assert out[2] == 'สาม'                            # stays at ITS index, not shifted to [1]


def test_malformed_marker_does_not_leak_or_shift():
    resp = '<|1|>เริ่มจากตัวเอก <|2|>ถึงอิริส! <|3| <|4| <|5|'
    out = parse_numbered_translations(resp, 2)
    assert out[0] == 'เริ่มจากตัวเอก'
    assert out[1] == 'ถึงอิริส!'                       # no leaked '<|3| <|4| <|5|'


def test_single_query_without_prefix_kept():
    out = parse_numbered_translations('ข้อความเดียว', 1)
    assert out == ['ข้อความเดียว']


def test_exactly_n_returned_even_when_short():
    out = parse_numbered_translations('<|1|>เอ', 3)
    assert len(out) == 3
