"""Per-request translator credentials reach the ChatGPT client (#893).

`Backend/src/books/mit-config.ts` sends `translator.api_key` / `api_url` when LLM_PROVIDER is not gemini.
`TranslatorConfig` dropped both, and `OpenAITranslator` built its client from `.env` only — so a non-gemini
deployment either hit the wrong endpoint or failed at construction despite carrying a key.
"""
from manga_translator.config import TranslatorConfig


def test_translator_config_keeps_per_request_credentials_893():
    cfg = TranslatorConfig(api_key='KEY-1', api_url='http://gateway.invalid/v1')
    assert cfg.api_key == 'KEY-1'
    assert cfg.api_url == 'http://gateway.invalid/v1'


def test_openai_translator_repoints_its_client_from_the_request_893(monkeypatch):
    from manga_translator.translators import chatgpt as chatgpt_mod

    monkeypatch.setattr(chatgpt_mod, 'OPENAI_API_KEY', '', raising=False)
    translator = chatgpt_mod.OpenAITranslator(check_openai_key=False)
    assert translator.client is None  # nothing to build from yet

    translator.parse_args(TranslatorConfig(api_key='REQ-KEY', api_url='http://gateway.invalid/v1'))
    assert translator.client is not None
    assert 'gateway.invalid' in str(translator.client.base_url)
    assert translator.client.api_key == 'REQ-KEY'


def test_env_only_setups_keep_the_env_client_893(monkeypatch):
    from manga_translator.translators import chatgpt as chatgpt_mod

    monkeypatch.setattr(chatgpt_mod, 'OPENAI_API_KEY', 'ENV-KEY', raising=False)
    monkeypatch.setattr(chatgpt_mod, 'OPENAI_API_BASE', 'http://env.invalid/v1', raising=False)
    translator = chatgpt_mod.OpenAITranslator()
    assert translator.client is not None
    assert 'env.invalid' in str(translator.client.base_url)

    # a request without credentials leaves the env client untouched (byte-identical behavior)
    translator.parse_args(TranslatorConfig())
    assert 'env.invalid' in str(translator.client.base_url)