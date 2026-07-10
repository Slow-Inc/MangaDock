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
