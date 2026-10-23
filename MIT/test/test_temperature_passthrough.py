"""Per-request temperature passthrough (MIT_TEMPERATURE / translator.temperature)."""
from manga_translator.config import Config


def test_a_temperature_override_reaches_the_chatgpt_config():
    cfg = Config(translator={'temperature': 0.2})
    assert cfg.translator.temperature == 0.2
    overrides = cfg.translator.chatgpt_config
    assert overrides is not None and float(overrides['temperature']) == 0.2


def test_absent_temperature_leaves_the_translator_default():
    cfg = Config(translator={})
    assert cfg.translator.temperature is None

