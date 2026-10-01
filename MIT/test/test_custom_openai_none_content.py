"""#631 — custom_openai: a None message.content must be a failed attempt, not a TypeError.

On dense pages the OpenAI-compatible gateway returns `choices[0].message.content = None`
(the model spent its token budget). Before the fix that None flowed into
`extract_capture_groups` -> `re.findall(pattern, None)` -> TypeError -> the whole page
failed with HTTP 500. After the fix, a None (or non-string) content raises
`openai.APIError` from `_request_translation`, which the existing retry loop
(`custom_openai.py`, the `except openai.APIError` branch) treats like any other server
error: retried `_RETRY_ATTEMPTS` times, then re-raised.

Torch-free: the module under test is loaded through `_torch_free_import.load_custom_openai`
(same rationale as conftest.py #359).
"""
import asyncio
from types import SimpleNamespace
from unittest import mock

import pytest

import openai


from _torch_free_import import load_custom_openai


custom_openai = load_custom_openai()


def _fake_response(content, finish_reason='length', total_tokens=100):
    # finish_reason lives on the choice, not the message (openai SDK: Choice has
    # finish_reason/index/logprobs/message; ChatCompletionMessage does not).
    return SimpleNamespace(
        choices=[SimpleNamespace(
            finish_reason=finish_reason,
            message=SimpleNamespace(content=content),
        )],
        usage=SimpleNamespace(total_tokens=total_tokens, prompt_tokens=10, completion_tokens=90),
    )


def _make_translator():
    return custom_openai.CustomOpenAiTranslator()


def test_none_content_every_attempt_fails_via_api_error_path():
    """A None reply on every attempt -> no TypeError; the translator fails through the
    existing server-error path: openai.APIError re-raised after _RETRY_ATTEMPTS retries."""
    t = _make_translator()
    t.client.chat.completions.create = mock.AsyncMock(
        return_value=_fake_response(None, finish_reason='length'))
    with pytest.raises(openai.APIError):
        asyncio.run(t.translate('auto', 'ENG', ['hello']))
    # went through the existing retry branch, not a TypeError crash
    assert t.client.chat.completions.create.call_count == t._RETRY_ATTEMPTS


def test_none_content_then_valid_reply_returns_translation():
    """A None reply first, then a valid reply -> the valid translation is returned
    (proves None is retried, not fatal)."""
    t = _make_translator()
    t.client.chat.completions.create = mock.AsyncMock(side_effect=[
        _fake_response(None, finish_reason='length'),
        _fake_response('<|1|>hello world', finish_reason='stop'),
    ])
    result = asyncio.run(t.translate('auto', 'ENG', ['hello']))
    assert result == ['hello world']
    assert t.client.chat.completions.create.call_count == 2


def test_none_content_logs_warning_naming_finish_reason(caplog):
    """One warning per None reply, naming finish_reason when the response carries it."""
    t = _make_translator()
    t.client.chat.completions.create = mock.AsyncMock(
        return_value=_fake_response(None, finish_reason='length'))
    with caplog.at_level('WARNING'):
        with pytest.raises(openai.APIError):
            asyncio.run(t.translate('auto', 'ENG', ['hello']))
    warnings = [r for r in caplog.records
                if r.levelname == 'WARNING' and 'finish_reason=length' in r.getMessage()]
    assert len(warnings) == t._RETRY_ATTEMPTS
