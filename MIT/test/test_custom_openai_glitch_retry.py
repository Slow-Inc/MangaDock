"""A translation that leaks a foreign script is re-asked (quality loop, 2026-10-20).

Measured on 6 runs x 17 real pages: qwen leaks Chinese/Cyrillic/Korean into Thai at random
under every prompt tried ('甚至连', 'Чит', '체인'). CommonTranslator already repeats invalid
segments (`_INVALID_REPEAT_COUNT`, custom_openai = 2) and overwrites ONLY those; a glitched
segment must count as invalid so it gets that repeat. A clean page makes exactly one call.
"""
import asyncio
import json
from types import SimpleNamespace
from unittest import mock

from manga_translator.translators.custom_openai import CustomOpenAiTranslator


def _reply(text):
    return SimpleNamespace(
        choices=[SimpleNamespace(finish_reason='stop', message=SimpleNamespace(content=text))],
        usage=SimpleNamespace(total_tokens=10, prompt_tokens=5, completion_tokens=5))


def test_a_leaked_script_is_reasked_and_only_that_segment_replaced():
    t = CustomOpenAiTranslator()
    t.client.chat.completions.create = mock.AsyncMock(side_effect=[
        _reply('<|1|>ฉัน甚至连ให้พลังเธอไม่ได้\n<|2|>ลาก่อน'),
        _reply('<|1|>ฉันให้พลังเธอไม่ได้เลย\n<|2|>บ๊ายบาย'),
    ])
    out = asyncio.run(t.translate('ENG', 'THA', ['I CANT EVEN GIVE YOU POWER', 'BYE']))
    assert out == ['ฉันให้พลังเธอไม่ได้เลย', 'ลาก่อน']
    assert t.client.chat.completions.create.call_count == 2


def test_a_clean_page_is_translated_once():
    t = CustomOpenAiTranslator()
    t.client.chat.completions.create = mock.AsyncMock(return_value=_reply('<|1|>สวัสดี\n<|2|>ลาก่อน'))
    out = asyncio.run(t.translate('ENG', 'THA', ['HELLO', 'BYE']))
    assert out == ['สวัสดี', 'ลาก่อน']
    assert t.client.chat.completions.create.call_count == 1


def test_a_script_the_source_already_uses_is_not_a_leak():
    """Review 2026-10-20: the default prompt keeps SFX untranslated, so a JP page's kana SFX in a
    Thai translation was re-asked twice (three full-page calls) and shipped anyway. A script the
    source itself uses was copied, not leaked."""
    t = CustomOpenAiTranslator()
    t.client.chat.completions.create = mock.AsyncMock(return_value=_reply('<|1|>ドン!\n<|2|>ลาก่อน'))
    out = asyncio.run(t.translate('JPN', 'THA', ['ドン!', 'さようなら']))
    assert out == ['ドン!', 'ลาก่อน']
    assert t.client.chat.completions.create.call_count == 1


def _system_message(t, to_lang, sources):
    t.client.chat.completions.create = mock.AsyncMock(return_value=_reply('<|1|>x'))
    asyncio.run(t.translate('JPN', to_lang, sources))
    return t.client.chat.completions.create.call_args.kwargs['messages'][0]['content']


def test_thai_uses_the_thai_manga_prompt_by_default():
    """#762 (2026-10-21): the generic prompt inserted a spurious 'ทน' ('ฉันทนฟังบทสนทนา' for "I heard
    your conversation", 'ฉันทะโกด') on Tsuki p1 in 1 of 3 runs and across the corpus; the Thai prompt
    v2 did not in 9 runs and left 0 segments untranslated. Thai gets it by default."""
    sys_msg = _system_message(CustomOpenAiTranslator(), 'THA', ['I HEARD YOUR CONVERSATION'])
    assert 'Thai editions of manga' in sys_msg


def test_other_targets_keep_the_generic_prompt():
    sys_msg = _system_message(CustomOpenAiTranslator(), 'ENG', ['こんにちは'])
    assert 'Thai editions of manga' not in sys_msg


def test_a_dropped_japanese_negation_is_reasked_898():
    """Real JP->TH path: 可愛くない came out น่ารักดีนะ in 2 of 4 runs; the retry loop must catch and re-ask."""
    t = CustomOpenAiTranslator()
    t.client.chat.completions.create = mock.AsyncMock(side_effect=[
        _reply('<|1|>แต่เด็กนี่น่ารักดีนะ'),
        _reply('<|1|>แต่เด็กนี่ไม่น่ารักเลยนะ'),
    ])
    out = asyncio.run(t.translate('JPN', 'THA', ['でも可愛くないなコイツ']))
    assert out == ['แต่เด็กนี่ไม่น่ารักเลยนะ']
    assert t.client.chat.completions.create.call_count == 2


def test_an_english_source_is_not_reasked_for_a_missing_thai_negation_898():
    """Only Japanese sources are checked: EN idioms ("like there's no tomorrow") legitimately lose the word."""
    t = CustomOpenAiTranslator()
    t.client.chat.completions.create = mock.AsyncMock(return_value=_reply('<|1|>ราวกับวันสุดท้ายของชีวิต!'))
    out = asyncio.run(t.translate('ENG', 'THA', ['LIKE THERES NO TOMORROW!']))
    assert out == ['ราวกับวันสุดท้ายของชีวิต!']
    assert t.client.chat.completions.create.call_count == 1


def test_a_runaway_page_output_is_reasked_901():
    """#901: a looping page output (short pattern cycling) is far longer than the source; the page is re-asked."""
    t = CustomOpenAiTranslator()
    loop = '<|1|>' + ('แม่นดูหมั้นแม่นดูรัก' * 20)
    t.client.chat.completions.create = mock.AsyncMock(side_effect=[
        _reply(loop),
        _reply('<|1|>แม่นยายโหราศาสตร์!')
    ])
    out = asyncio.run(t.translate('ENG', 'THA', ['YOU WERE SPOT ON, GOD- MOTHER!']))
    assert out == ['แม่นยายโหราศาสตร์!']
    assert t.client.chat.completions.create.call_count == 2


def test_a_cyrillic_leak_is_reasked_with_an_explicit_note_903():
    """Real corpus leak: the model transliterated Tsukuyomi into Cyrillic (ЦУКУโยมิ) through every retry."""
    t = CustomOpenAiTranslator()
    t.client.chat.completions.create = mock.AsyncMock(side_effect=[
        _reply('<|1|>ЦУКУโยมิ!'),
        _reply('<|1|>สึกุโยมิ!'),
    ])
    out = asyncio.run(t.translate('ENG', 'THA', ['TSUKU- YOMI!']))
    assert out == ['สึกุโยมิ!']
    assert t.client.chat.completions.create.call_count == 2
    second = json.dumps(t.client.chat.completions.create.call_args_list[1].kwargs, ensure_ascii=False)
    assert 'target script only' in second and 'transliterate names' in second
