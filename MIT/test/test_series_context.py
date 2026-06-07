"""Series context (#157) — prompt-assembly seam, no ML imports.

The Backend composes a series-context string and sends it inside the
translator config. MIT's job is carriage + one append seam:

- `TranslatorConfig.series_context` rides the per-request config and is
  exposed through `chatgpt_config` so every ConfigGPT-family translator
  (Qwen3, Gemini, ChatGPT, DeepSeek) picks it up via `_config_get`.
- `append_series_context` appends it to the system template. Call sites run
  `.format(to_lang=...)` on the result, so the context must be brace-escaped
  or a synopsis containing `{}` would crash prompt assembly.
- Absent context → byte-identical template (local-first rule).

`manga_translator.translators` imports the ML stack (~10s, torch), so the
ConfigGPT wiring is checked by source inspection — the same pattern as
test_page_context.py.
"""
import re
from pathlib import Path

from manga_translator.config import TranslatorConfig
from manga_translator.series_context import append_series_context

TEMPLATE = 'You are a translator. Translate to {to_lang}.'


# ── append_series_context (pure) ─────────────────────────────────────────────

def test_no_context_returns_template_byte_identical():
    assert append_series_context(TEMPLATE, None) is TEMPLATE
    assert append_series_context(TEMPLATE, '') is TEMPLATE


def test_context_is_appended_and_survives_format():
    out = append_series_context(TEMPLATE, 'You are translating "Mob Seka".')
    assert out.startswith(TEMPLATE)
    assert 'Mob Seka' in out
    # The exact string the model sees, after the call sites' .format():
    formatted = out.format(to_lang='Thai')
    assert 'Translate to Thai.' in formatted
    assert 'You are translating "Mob Seka".' in formatted


def test_braces_in_context_do_not_break_format():
    out = append_series_context(TEMPLATE, 'Synopsis: a {weird} JSON-y {snippet}.')
    formatted = out.format(to_lang='Thai')  # must not raise KeyError
    assert 'a {weird} JSON-y {snippet}.' in formatted


# ── TranslatorConfig carriage ────────────────────────────────────────────────

def test_series_context_rides_chatgpt_config():
    cfg = TranslatorConfig(series_context='You are translating "Mob Seka".')
    assert cfg.chatgpt_config is not None
    assert cfg.chatgpt_config.series_context == 'You are translating "Mob Seka".'


def test_absent_series_context_keeps_chatgpt_config_none():
    assert TranslatorConfig().chatgpt_config is None


# ── ConfigGPT wiring (source inspection — importing it loads torch) ─────────

def test_chat_system_template_appends_series_context():
    src = (Path(__file__).parent.parent / 'manga_translator' / 'translators' / 'config_gpt.py').read_text(encoding='utf-8')
    prop = re.search(r'def chat_system_template\(self\).*?(?=\n    @|\n    def )', src, re.S)
    assert prop, 'chat_system_template property not found'
    assert 'append_series_context' in prop.group(0)
    assert "_config_get('series_context')" in prop.group(0)
