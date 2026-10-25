"""#623 root cause: qwen3-style reasoning models spend the whole `max_tokens`
budget on `<think>` output and return `content=None` on dense pages (the
One-Punch benchmark narration group: 6502 chars of reasoning → completion=2048
cap hit → empty content → translate 500s the whole page). The fix disables the
model's native thinking via `chat_template_kwargs.enable_thinking=false`, gated
by `CUSTOM_OPENAI_ENABLE_THINKING` (.env, default OFF)."""
from manga_translator.translators.custom_openai import (
    resolve_enable_thinking,
    thinking_extra_body,
)


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


# Wiring (ported from main's #706 test): the helpers above only matter if
# _request_translation actually hands their result to chat.completions.create.
# content=None ends the call with EmptyContentError (#631), so one call is enough.
def _extra_body_sent_by_request(monkeypatch, env_value):
    import asyncio
    from types import SimpleNamespace
    from unittest import mock

    import pytest

    from manga_translator.translators.custom_openai import CustomOpenAiTranslator, EmptyContentError

    if env_value is None:
        monkeypatch.delenv('CUSTOM_OPENAI_ENABLE_THINKING', raising=False)
    else:
        monkeypatch.setenv('CUSTOM_OPENAI_ENABLE_THINKING', env_value)
    t = CustomOpenAiTranslator()
    create = mock.AsyncMock(return_value=SimpleNamespace(
        choices=[SimpleNamespace(finish_reason='length', message=SimpleNamespace(content=None))],
        usage=SimpleNamespace(total_tokens=1, prompt_tokens=1, completion_tokens=0),
    ))
    t.client.chat.completions.create = create
    with pytest.raises(EmptyContentError):
        asyncio.run(t._request_translation('ENG', 'hello'))
    return create.call_args.kwargs.get('extra_body')


def test_request_sends_thinking_off_body_by_default(monkeypatch):
    assert _extra_body_sent_by_request(monkeypatch, None) == {
        'chat_template_kwargs': {'enable_thinking': False}}


def test_request_sends_no_extra_body_when_thinking_enabled(monkeypatch):
    assert _extra_body_sent_by_request(monkeypatch, 'true') is None


def test_translator_clients_share_the_tls_context():
    """#1119: building the translator must not build a new SSLContext (~140 ms of CPU) for its client."""
    import manga_translator.tls as tls
    from manga_translator.translators.custom_openai import CustomOpenAiTranslator
    t = CustomOpenAiTranslator()
    assert t.client._client._transport._pool._ssl_context is tls.ssl_context()
