"""P7 bubble-length directive (Master Plan 2, #526-adjacent).

The #1 render defect on tight bubbles is a TRANSLATION that is physically too long for the balloon
(measured on Gal Yome EN p4: 7 lines @ 18px ≈ 151px in a ~70px bubble → clipped). No wrap algorithm
fixes "too much text in a tiny bubble" — the lever is a shorter translation. This gates an optional
bubble-length directive on the GPT system prompt; default OFF → byte-identical.
"""
from omegaconf import OmegaConf

from manga_translator.translators.config_gpt import ConfigGPT

MARK = 'Bubble-length constraint'


def test_default_off_is_byte_identical():
    c = ConfigGPT('')
    assert MARK not in c.chat_system_template  # no config → unchanged


def test_concise_bubbles_true_appends_the_directive():
    c = ConfigGPT('')
    c.config = OmegaConf.create({'concise_bubbles': True})
    t = c.chat_system_template
    assert MARK in t
    assert t.startswith(c._CHAT_SYSTEM_TEMPLATE[:40])  # base prompt preserved, directive appended


def test_concise_bubbles_false_stays_off():
    c = ConfigGPT('')
    c.config = OmegaConf.create({'concise_bubbles': False})
    assert MARK not in c.chat_system_template
