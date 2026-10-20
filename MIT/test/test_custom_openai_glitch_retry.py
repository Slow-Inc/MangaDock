"""A translation that leaks a foreign script is re-asked (quality loop, 2026-10-20).

Measured on 6 runs x 17 real pages: qwen leaks Chinese/Cyrillic/Korean into Thai at random
under every prompt tried ('甚至连', 'Чит', '체인'). CommonTranslator already repeats invalid
segments (`_INVALID_REPEAT_COUNT`, custom_openai = 2) and overwrites ONLY those; a glitched
segment must count as invalid so it gets that repeat. A clean page makes exactly one call.
"""
import asyncio
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
