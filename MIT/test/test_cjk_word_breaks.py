"""Chinese word-break segmentation for non-ENG render parity (line-break references the original).

English wraps on spaces; Thai uses pythainlp. Chinese has no spaces and was char-split (breaks
mid-word). `_insert_cjk_word_breaks` runs jieba and inserts zero-width spaces between words so
`calc_horizontal` wraps on word boundaries — invisible in the rendered glyphs, no chars lost.
"""
from manga_translator.rendering.text_render import _insert_cjk_word_breaks, _ZWSP


def test_inserts_zwsp_between_chinese_words_without_losing_chars():
    text = '我没关系放着不管吧'                       # "it's none of my business, just leave it"
    out = _insert_cjk_word_breaks(text)
    assert _ZWSP in out                              # word boundaries marked for wrapping
    assert out.replace(_ZWSP, '') == text            # only invisible breaks added — no char loss


def test_leaves_non_chinese_text_unchanged():
    assert _insert_cjk_word_breaks('hello world') == 'hello world'        # Latin: spaces already
    assert _insert_cjk_word_breaks('สวัสดีครับ') == 'สวัสดีครับ'           # Thai handled elsewhere
    assert _insert_cjk_word_breaks('') == ''
