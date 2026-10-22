"""#980: the name glossary rides the chatgpt_config seam into the production system prompt."""
from manga_translator.config import TranslatorConfig
from manga_translator.translators.custom_openai import CustomOpenAiTranslator

BLOCK = "\n\n## Consistent character names\nTSUKUYOMI = ทสึคุโยมิ.\n"


def test_the_glossary_reaches_the_custom_openai_system_prompt_980():
    tr = CustomOpenAiTranslator()
    tr.parse_args(TranslatorConfig(translator='custom_openai', target_lang='THA', name_glossary=BLOCK))
    assert "TSUKUYOMI = ทสึคุโยมิ" in tr.system_prompt("THA")


def test_without_a_glossary_the_prompt_is_unchanged_980():
    plain = CustomOpenAiTranslator()
    plain.parse_args(TranslatorConfig(translator='custom_openai', target_lang='THA'))
    with_glossary = CustomOpenAiTranslator()
    with_glossary.parse_args(TranslatorConfig(translator='custom_openai', target_lang='THA', name_glossary=BLOCK))
    plain_prompt = plain.system_prompt("THA")
    glossary_prompt = with_glossary.system_prompt("THA")
    assert "character names" not in plain_prompt
    assert glossary_prompt.startswith(plain_prompt)
    assert len(glossary_prompt) > len(plain_prompt)