"""#631 — custom_openai: a None message.content must be a failed attempt, not a TypeError.

On dense pages the OpenAI-compatible gateway returns `choices[0].message.content = None`
(the model spent its token budget). Before the fix that None flowed into
`extract_capture_groups` -> `re.findall(pattern, None)` -> TypeError -> the whole page
failed with HTTP 500. After the fix, a None (or non-string) content raises
`openai.APIError` from `_request_translation`, which the existing retry loop
(`custom_openai.py`, the `except openai.APIError` branch) treats like any other server
error: retried `_RETRY_ATTEMPTS` times, then re-raised.

Torch-free: the `translators` package `__init__` and `manga_translator.utils.inference`
are the two torch entry points in this import chain; both are stubbed in sys.modules
before importing the module under test (same rationale as conftest.py #359).
"""
import asyncio
import os
import sys
import types
from types import SimpleNamespace
from unittest import mock

import pytest

import openai


_MISSING = object()


def _load_translator_module():
    """Import manga_translator.translators.custom_openai without loading torch.

    The `translators` package __init__ and `manga_translator.utils.inference` are the
    two torch entry points in this import chain (same rationale as conftest.py #359).
    They are stubbed in sys.modules for the duration of the import only; every entry
    touched here is restored afterwards — including the translator submodules this
    import pulls in, whose classes would otherwise carry the stub base classes in
    their MRO — so later tests in the session re-import them fresh and nothing leaks.
    """
    if 'manga_translator.translators.custom_openai' in sys.modules:
        return sys.modules['manga_translator.translators.custom_openai']

    import manga_translator

    _touched = (
        'manga_translator.utils.inference',
        'manga_translator.translators',
        'manga_translator.translators.common',
        'manga_translator.translators.config_gpt',
        'manga_translator.translators.keys',
        'manga_translator.translators.custom_openai',
    )
    saved = {name: sys.modules.get(name) for name in _touched}
    # __dict__, not hasattr/getattr: the package's PEP 562 __getattr__ would import
    # the heavy manga_translator.manga_translator module (torch).
    saved_parent_attr = manga_translator.__dict__.get('translators', _MISSING)

    try:
        # 1) stub the torch-only utils submodule: common.py does
        #    `from ..utils import InfererModule, ModelWrapper`, which would otherwise
        #    trigger utils.__getattr__ -> import utils.inference -> torch.
        inf = types.ModuleType('manga_translator.utils.inference')

        from manga_translator.utils.log import get_logger

        class InfererModule:
            def __init__(self):
                self.logger = get_logger(self.__class__.__name__)

        class ModelWrapper:
            """Empty stand-in: needed only as a base class for common.py's class
            definitions; never instantiated by these tests."""

        inf.InfererModule = InfererModule
        inf.ModelWrapper = ModelWrapper
        sys.modules['manga_translator.utils.inference'] = inf

        # 2) stub the translators package __init__ (it imports the ML stack).
        pkg = types.ModuleType('manga_translator.translators')
        pkg.__path__ = [os.path.join(os.path.dirname(manga_translator.__file__), 'translators')]
        sys.modules['manga_translator.translators'] = pkg
        manga_translator.__dict__['translators'] = pkg

        import manga_translator.translators.custom_openai as co
    finally:
        for name, prev in saved.items():
            if prev is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = prev
        if saved_parent_attr is _MISSING:
            manga_translator.__dict__.pop('translators', None)
        else:
            manga_translator.__dict__['translators'] = saved_parent_attr

    return co


custom_openai = _load_translator_module()


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
