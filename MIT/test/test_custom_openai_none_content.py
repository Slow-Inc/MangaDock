"""#631: the 9arm gateway intermittently returns a completion whose message.content is
None (the #623 dense-page failure mode, NOT fully prevented by thinking-off). The
translator must treat that as a RETRYABLE failure — never pass None into
extract_capture_groups (re.findall(None) → TypeError → whole page 500s in prod)."""
import asyncio
from types import SimpleNamespace

import pytest

from manga_translator.translators.custom_openai import (
    CustomOpenAiTranslator,
    EmptyContentError,
)


def _resp(content, total=10):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content),
                                 finish_reason='stop')],
        usage=SimpleNamespace(total_tokens=total, prompt_tokens=5, completion_tokens=5),
    )


class _FakeCompletions:
    def __init__(self, contents):
        self._contents = list(contents)
        self.calls = 0

    async def create(self, **kwargs):
        self.calls += 1
        return _resp(self._contents.pop(0))


def _translator(contents):
    t = CustomOpenAiTranslator()
    fake = _FakeCompletions(contents)
    t.client = SimpleNamespace(chat=SimpleNamespace(completions=fake), base_url='http://fake')
    return t, fake


def test_none_content_raises_retryable_not_typeerror():
    # _request_translation must raise the retryable error, not return None.
    t, _ = _translator([None])
    with pytest.raises(EmptyContentError):
        asyncio.run(t._request_translation('ENG', '<|1|>こんにちは'))


def test_translate_retries_none_then_succeeds():
    # 1st attempt content=None → retry → 2nd attempt real text → translations returned.
    t, fake = _translator([None, '<|1|>HELLO'])
    out = asyncio.run(t._translate('JPN', 'ENG', ['こんにちは']))
    assert fake.calls == 2
    assert out == ['HELLO']


def test_translate_gives_up_after_retries_without_typeerror():
    # All attempts None → a clear exception (not TypeError from re.findall(None)).
    t, _ = _translator([None] * 10)
    with pytest.raises(Exception) as ei:
        asyncio.run(t._translate('JPN', 'ENG', ['こんにちは']))
    assert not isinstance(ei.value, TypeError)
    assert 'empty content' in str(ei.value).lower() or 'EmptyContent' in type(ei.value).__name__


# #631 root: qwen3.6 via the gateway IGNORES every thinking-disable lever (reasoning ~6-8k chars
# regardless) — so the completion cap must leave room for reasoning + content. The old
# max_tokens = _MAX_TOKENS//2 = 2048 hit finish=length with content=None on dense pages.
def test_max_completion_tokens_default_covers_reasoning():
    from manga_translator.translators.custom_openai import resolve_max_completion_tokens
    assert resolve_max_completion_tokens({}) == 4096


def test_max_completion_tokens_env_override():
    from manga_translator.translators.custom_openai import resolve_max_completion_tokens
    assert resolve_max_completion_tokens({'CUSTOM_OPENAI_MAX_COMPLETION_TOKENS': '6144'}) == 6144
    assert resolve_max_completion_tokens({'CUSTOM_OPENAI_MAX_COMPLETION_TOKENS': 'junk'}) == 4096


# When thinking is ON the reasoning eats far MORE of the budget (measured on the 9arm gateway:
# ~2k reasoning tokens even for a 2-line translate, and the disable levers are no-ops), so a
# SEPARATE, larger cap applies — CUSTOM_OPENAI_THINKING_MAX_COMPLETION_TOKENS (default 8192).
def test_thinking_budget_default_larger_than_base():
    from manga_translator.translators.custom_openai import resolve_max_completion_tokens
    assert resolve_max_completion_tokens({}, thinking=True) == 8192
    assert resolve_max_completion_tokens({}, thinking=True) > resolve_max_completion_tokens({}, thinking=False)


def test_thinking_budget_env_override():
    from manga_translator.translators.custom_openai import resolve_max_completion_tokens
    env = {'CUSTOM_OPENAI_THINKING_MAX_COMPLETION_TOKENS': '12000'}
    assert resolve_max_completion_tokens(env, thinking=True) == 12000
    assert resolve_max_completion_tokens({'CUSTOM_OPENAI_THINKING_MAX_COMPLETION_TOKENS': 'junk'}, thinking=True) == 8192


def test_thinking_flag_selects_the_right_env():
    # thinking=False must NOT read the thinking env (uses base); thinking=True must NOT read the base env.
    from manga_translator.translators.custom_openai import resolve_max_completion_tokens
    both = {'CUSTOM_OPENAI_MAX_COMPLETION_TOKENS': '6144',
            'CUSTOM_OPENAI_THINKING_MAX_COMPLETION_TOKENS': '12000'}
    assert resolve_max_completion_tokens(both, thinking=False) == 6144
    assert resolve_max_completion_tokens(both, thinking=True) == 12000
