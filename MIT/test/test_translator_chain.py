"""Translator-chain parsing (#192 — extract config.py's `# TODO: Refactor`
TranslatorChain). The parse of 'trans:lang;trans:lang' is pulled into a pure
function with the validity sets + name resolver injected, so it unit-tests with no
`manga_translator.translators` / ML imports. Semantics match the original verbatim:
unknown translator NAME raises (resolver KeyError), a known-but-disabled translator
or unknown language raises ValueError, empty input raises Exception.
"""
import pytest

from manga_translator.translator_chain import parse_translator_chain

# stub: a "Translator enum" of known names; resolver raises KeyError on unknown name
_ENUM = {"google": "google", "sugoi": "sugoi", "gpt": "gpt", "disabled": "disabled"}
_resolve = lambda s: _ENUM[s]
_VALID_T = {"google", "sugoi", "gpt"}          # "disabled" is a valid name but not enabled
_VALID_L = {"ENG", "THA", "JPN"}


def test_parses_a_single_translator_lang_pair():
    assert parse_translator_chain("google:ENG", _resolve, _VALID_T, _VALID_L) == [("google", "ENG")]


def test_parses_a_multi_step_chain_in_order():
    assert parse_translator_chain("google:ENG;sugoi:JPN", _resolve, _VALID_T, _VALID_L) \
        == [("google", "ENG"), ("sugoi", "JPN")]


def test_empty_string_raises():
    with pytest.raises(Exception):
        parse_translator_chain("", _resolve, _VALID_T, _VALID_L)


def test_unknown_translator_name_propagates_resolver_keyerror():
    with pytest.raises(KeyError):
        parse_translator_chain("nope:ENG", _resolve, _VALID_T, _VALID_L)


def test_known_but_disabled_translator_raises_valueerror():
    with pytest.raises(ValueError):
        parse_translator_chain("disabled:ENG", _resolve, _VALID_T, _VALID_L)


def test_unknown_language_raises_valueerror():
    with pytest.raises(ValueError):
        parse_translator_chain("google:XXX", _resolve, _VALID_T, _VALID_L)


def test_config_translatorchain_delegates_to_the_pure_parser():
    """Source-inspection (no ML import): config.TranslatorChain uses the extracted
    parser, so the unit tests above actually guard the production path."""
    from pathlib import Path
    cfg = (Path(__file__).parent.parent / 'manga_translator' / 'config.py').read_text(encoding='utf-8')
    assert 'from .translator_chain import parse_translator_chain' in cfg
    assert 'parse_translator_chain(string,' in cfg
