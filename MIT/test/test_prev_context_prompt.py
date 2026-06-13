"""Rolling cross-page context reaches the prompt via the #157 GPT-config seam (#159).

`TranslatorConfig.prev_context` (the Batch Job's front-built numbered block) rides the
same `chatgpt_config` carriage point as `series_context` (#157), and `ConfigGPT`'s
`chat_system_template` appends it — so every GPT-family translator (ChatGPT, Qwen3,
Gemini, DeepSeek, custom_openai) carries it. Absent → byte-identical prompt.
"""
from manga_translator.config import TranslatorConfig


def test_translator_config_exposes_prev_context_through_chatgpt_config():
    cfg = TranslatorConfig(prev_context='BLOCK-A')
    merged = cfg.chatgpt_config
    assert merged is not None
    assert merged.prev_context == 'BLOCK-A'


def test_chatgpt_config_is_none_when_no_context_and_no_gpt_config():
    # absent context + no gpt_config file → byte-identical (None) as before
    assert TranslatorConfig().chatgpt_config is None


def test_series_and_prev_context_coexist_on_chatgpt_config():
    cfg = TranslatorConfig(series_context='SERIES', prev_context='PREV')
    merged = cfg.chatgpt_config
    assert merged.series_context == 'SERIES'
    assert merged.prev_context == 'PREV'


def test_chat_system_template_appends_prev_context_block():
    from manga_translator.translators.config_gpt import ConfigGPT

    class _Cfg(ConfigGPT):
        def __init__(self, prev):
            self._prev = prev

        def _config_get(self, key, default=None):
            return {
                'prev_context': self._prev,
                'series_context': None,
                'chat_system_template': 'BASE TEMPLATE',
            }.get(key, default)

    block = 'Here are the previous translation results for reference:\n<|1|>Hello'
    out = _Cfg(block).chat_system_template
    assert 'BASE TEMPLATE' in out and block in out                 # appended
    assert _Cfg(None).chat_system_template == 'BASE TEMPLATE'      # absent → unchanged
