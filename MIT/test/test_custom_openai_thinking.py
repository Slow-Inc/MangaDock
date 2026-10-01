"""#623 root cause: qwen3-style reasoning models spend the whole `max_tokens`
budget on `<think>` output and return `content=None` on dense pages (the
One-Punch benchmark narration group: 6502 chars of reasoning → completion=2048
cap hit → empty content → translate 500s the whole page). The fix disables the
model's native thinking via `chat_template_kwargs.enable_thinking=false`, gated
by `CUSTOM_OPENAI_ENABLE_THINKING` (.env, default OFF)."""
import asyncio
from types import SimpleNamespace
from unittest import mock

import openai
import pytest

from _torch_free_import import load_custom_openai

_co = load_custom_openai()
resolve_enable_thinking = _co.resolve_enable_thinking
thinking_extra_body = _co.thinking_extra_body


def test_thinking_disabled_by_default():
    # Empty env → thinking OFF (the fix): a bare deploy must not regress to the
    # content=None failure on dense pages.
    assert resolve_enable_thinking({}) is False


def test_thinking_enabled_when_env_truthy():
    for v in ('true', 'True', '1', 'yes', 'on'):
        assert resolve_enable_thinking({'CUSTOM_OPENAI_ENABLE_THINKING': v}) is True


def test_thinking_stays_disabled_for_falsey_env():
    for v in ('false', '0', 'no', 'off', ''):
        assert resolve_enable_thinking({'CUSTOM_OPENAI_ENABLE_THINKING': v}) is False


def test_extra_body_suppresses_thinking_when_disabled():
    # The one param the gateway honors (verified live: enable_thinking=false under
    # chat_template_kwargs → reasoning gone, content populated in 86 tokens).
    assert thinking_extra_body(False) == {'chat_template_kwargs': {'enable_thinking': False}}


def test_extra_body_none_when_thinking_enabled():
    # Enabled → send nothing extra, preserving default model behaviour.
    assert thinking_extra_body(True) is None


def _none_content_response():
    return SimpleNamespace(
        choices=[SimpleNamespace(finish_reason='length', message=SimpleNamespace(content=None))],
        usage=SimpleNamespace(total_tokens=1, prompt_tokens=1, completion_tokens=0),
    )


def _extra_body_sent_by_request(monkeypatch, env_value):
    # Wiring: the helpers above only matter if _request_translation actually hands their
    # result to chat.completions.create. content=None ends the call with an APIError
    # (#631), so one call is enough and nothing retries.
    if env_value is None:
        monkeypatch.delenv('CUSTOM_OPENAI_ENABLE_THINKING', raising=False)
    else:
        monkeypatch.setenv('CUSTOM_OPENAI_ENABLE_THINKING', env_value)
    t = _co.CustomOpenAiTranslator()
    create = mock.AsyncMock(return_value=_none_content_response())
    t.client.chat.completions.create = create
    with pytest.raises(openai.APIError):
        asyncio.run(t._request_translation('ENG', 'hello'))
    return create.call_args.kwargs['extra_body']


def test_request_sends_thinking_off_body_by_default(monkeypatch):
    assert _extra_body_sent_by_request(monkeypatch, None) == {
        'chat_template_kwargs': {'enable_thinking': False}}


def test_request_sends_no_extra_body_when_thinking_enabled(monkeypatch):
    assert _extra_body_sent_by_request(monkeypatch, 'true') is None
