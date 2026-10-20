"""CommonTranslator._clean_translation_output — the post-process every translation goes through."""
from manga_translator.translators.common import CommonTranslator


def clean(trans, query='X', to_lang='THA'):
    return CommonTranslator._clean_translation_output(None, query, trans, to_lang)


def test_numbers_keep_their_thousands_and_decimal_separators():
    """Mieruko p0 / Anta p1 (2026-10-21): '5,000 yen' rendered as '5, 000 เยน' — the
    'text.text' -> 'text. text' rule spaced every comma before a word character, digits included."""
    assert clean('ดูดวง นาทีละ 5,000 เยน') == 'ดูดวง นาทีละ 5,000 เยน'
    assert clean('RUA-HIME 20,000 วิว') == 'RUA-HIME 20,000 วิว'
    assert clean('พลังเพิ่มขึ้น 1.5 เท่า') == 'พลังเพิ่มขึ้น 1.5 เท่า'


def test_punctuation_between_words_still_gets_its_space():
    assert clean('Hello,world.Bye') == 'Hello, world. Bye'
    assert clean('ราคา 5,ไม่ใช่ 6') == 'ราคา 5, ไม่ใช่ 6'
    assert clean('ข้อ 2.ห้ามวิ่ง') == 'ข้อ 2. ห้ามวิ่ง'
