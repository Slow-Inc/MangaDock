"""Unit tests for GPT-translator few-shot sample selection (Issue #108).

The sample lookup must resolve the correct per-language sample with no staleness
across calls and no chat/JSON cross-contamination — without requiring the
optional `langcodes`/`language_data` dependency.
"""
from manga_translator.translators.config_gpt import ConfigGPT, TranslationList


def _cfg():
    # config is None -> samples come from the class defaults (_CHAT_SAMPLE / _JSON_SAMPLE)
    return ConfigGPT(config_key="gemini.test")


def test_no_language_staleness_across_calls():
    c = _cfg()
    th = c.get_chat_sample("Thai")
    en = c.get_chat_sample("English")
    assert th and en
    assert th != en                            # second language must not reuse the first
    assert "อาย" in th[1]                       # Thai output
    assert "embarrassed" in en[1].lower()      # English output


def test_language_code_resolves_to_name():
    c = _cfg()
    assert c.get_chat_sample("THA") == c.get_chat_sample("Thai")


def test_unknown_language_returns_empty():
    c = _cfg()
    assert c.get_chat_sample("Klingon") == []


def test_chat_and_json_samples_do_not_cross_contaminate():
    c = _cfg()
    chat = c.get_chat_sample("English")        # list[str]
    js = c.get_json_sample("English")          # list[TranslationList]
    assert isinstance(chat[0], str)
    assert isinstance(js[0], TranslationList)
